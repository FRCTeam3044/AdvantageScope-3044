import { convertLVTime, getPDType, PowerDistributionType } from "./DSUtil";

/** Represents a single DS cycle from a DSLog file */
export interface DSLogEntry {
  timestamp: number; // Local unix time in seconds (not LabView time)
  tripTimeMs: number;
  packetLoss: number;
  batteryVolts: number;
  rioCpuUtilization: number;
  brownout: boolean;
  watchdog: boolean;
  dsTeleop: boolean;
  dsDisabled: boolean;
  robotTeleop: boolean;
  robotAuto: boolean;
  robotDisabled: boolean;
  canUtilization: number;
  wifiDb: number;
  wifiMb: number;
  powerDistributionCurrents: number[];
}

/** Decodes a DSLog file. Based on the following resources:
 *
 * - https://github.com/orangelight/DSLOG-Reader/blob/master/DSLOG-Reader%202/DSLOG-Reader-Library/DSLOGReader.cs
 * - https://frcture.readthedocs.io/en/latest/driverstation/logging.html
 */
export class DSLogReader {
  private PERIOD_SECS = 0.02;

  private data: Uint8Array;
  private dataView: DataView;

  constructor(data: Uint8Array) {
    this.data = data;
    this.dataView = new DataView(data.buffer);
  }

  /** Returns the log version number. */
  getVersion(): number {
    return this.dataView.getInt32(0);
  }

  /** Returns whether this log uses a supported version. */
  isSupportedVersion(): boolean {
    return this.getVersion() === 4;
  }

  /** Returns the initial timestamp of the log, using unix time in seconds. */
  getTimestamp(): number {
    return convertLVTime(this.dataView.getBigInt64(4), this.dataView.getBigUint64(12));
  }

  /** Runs the specified function for each record in the log. */
  forEach(callback: (record: DSLogEntry) => void) {
    if (!this.isSupportedVersion()) throw "Log is not a supported version";
    let position = 4 + 8 + 8; // Header size
    let timestamp = 0;
    let lastBatteryVolts = 0;

    while (true) {
      // Get basic fields
      let mask = this.dataView.getUint8(position + 5);
      let batteryVolts = this.dataView.getUint16(position + 2) / Math.pow(2, 8);
      if (batteryVolts > 20) {
        // Sometimes the battery voltage spikes at the end of the log, ignore that value
        batteryVolts = lastBatteryVolts;
      } else {
        lastBatteryVolts = batteryVolts;
      }

      // Create entry
      let entry: DSLogEntry = {
        timestamp: timestamp,
        tripTimeMs: this.dataView.getUint8(position) * 0.5,
        packetLoss: Math.min(Math.max(this.dataView.getInt8(position + 1) * 4 * 0.01, 0), 1),
        batteryVolts: batteryVolts,
        rioCpuUtilization: this.dataView.getUint8(position + 4) * 0.5 * 0.01,
        brownout: (mask & (1 << 7)) === 0,
        watchdog: (mask & (1 << 6)) === 0,
        dsTeleop: (mask & (1 << 5)) === 0,
        dsDisabled: (mask & (1 << 3)) === 0,
        robotTeleop: (mask & (1 << 2)) === 0,
        robotAuto: (mask & (1 << 1)) === 0,
        robotDisabled: (mask & 1) === 0,
        canUtilization: this.dataView.getUint8(position + 6) * 0.5 * 0.01,
        wifiDb: this.dataView.getUint8(position + 7) * 0.5,
        wifiMb: this.dataView.getUint16(position + 8) / Math.pow(2, 8),
        powerDistributionCurrents: []
      };
      position += 10;

      // Get power distribution data
      let pdType = getPDType(this.dataView.getUint8(position + 3));
      position += 5;
      let currents: number[] = [];
      switch (pdType) {
        case PowerDistributionType.REV:
          // Read bytes
          let ints: number[] = [];
          for (let i = 0; i < 6; ++i) {
            ints.push(this.dataView.getUint32(position, true));
            position += 4;
          }
          let finalArrayREV = new Uint8Array(4);
          finalArrayREV.set(this.data.subarray(position, position + 2), 0);
          ints[6] = new DataView(finalArrayREV.buffer).getUint32(0);
          position += 3;
          let dataBytes = this.data.subarray(position, position + 4);
          position += 4;

          // Convert to final currents
          for (let i = 0; i < 20; ++i) {
            let dataIndex = Math.floor(i / 3);
            let dataOffset = i % 3;
            let data = ints[dataIndex];
            let num = data << (32 - (dataOffset + 1) * 10);
            num = num >>> 22;
            currents[i] = num / 8;
          }
          for (let i = 0; i < 4; ++i) {
            currents[i + 20] = dataBytes[i] / 16;
          }

          // Skip last byte (temperature data?)
          position += 1;
          break;

        case PowerDistributionType.CTRE:
          // Convert to boolean array
          let booleanData: boolean[] = [];
          this.data.subarray(position, position + 21).forEach((byte) => {
            for (let i = 0; i < 8; i++) {
              booleanData.push((byte & (1 << i)) !== 0);
            }
          });

          // Get currents
          let currentPositions = [0, 10, 20, 30, 40, 50, 64, 74, 84, 94, 104, 114, 128, 138, 148, 158];
          currentPositions.forEach((currentPosition) => {
            let value = 0;
            for (let i = 0; i < 8; i++) {
              value += booleanData[currentPosition + i] ? Math.pow(2, i) : 0;
            }
            currents.push(value / 16);
          });

          // Skip extra metadata
          position += 21 + 3;
          break;
      }
      entry.powerDistributionCurrents = currents;

      // Send entry
      callback(entry);

      // Adjust timestamp and check for end of log
      timestamp += this.PERIOD_SECS;
      if (position >= this.data.length) {
        break;
      }
    }
  }
}
