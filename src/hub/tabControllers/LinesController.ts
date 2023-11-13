import { Pose2d, Translation2d } from "../../shared/geometry";
import LoggableType from "../../shared/log/LoggableType";
import { ALLIANCE_KEYS, getIsRedAlliance } from "../../shared/log/LogUtil";
import TabType from "../../shared/TabType";
import { convert } from "../../shared/units";
import LinesVisualizer from "../../shared/visualizers/LinesVisualizer";
import TimelineVizController from "./TimelineVizController";

export default class LinesController extends TimelineVizController {
  private GAME: HTMLInputElement;
  private GAME_SOURCE_LINK: HTMLElement;
  private UNIT_DISTANCE: HTMLInputElement;
  private ORIGIN: HTMLInputElement;
  private LINE_THICKNESS: HTMLInputElement;
  private LINE_THICKNESS_TEXT: HTMLElement;
  private TRAJECTORY_THICKNESS: HTMLInputElement;
  private TRAJECTORY_THICKNESS_TEXT: HTMLElement;
  private POINT_SIZE: HTMLInputElement;
  private POINT_SIZE_TEXT: HTMLElement;

  private lastUnitDistance = "meters";
  private lastOptions: { [id: string]: any } | null = null;

  constructor(content: HTMLElement) {
    let configBody = content.getElementsByClassName("timeline-viz-config")[0].firstElementChild as HTMLElement;
    super(
      content,
      TabType.Lines,
      [],
      [
        {
          element: configBody.children[1].firstElementChild as HTMLElement,
          types: [LoggableType.NumberArray],
          options: [["Points", "Lines", "Trajectory"]]
        }
      ],
      new LinesVisualizer(content.getElementsByClassName("lines-canvas-container")[0] as HTMLElement)
    );

    // Get option inputs
    this.GAME = configBody.children[1].children[1].children[1] as HTMLInputElement;
    this.GAME_SOURCE_LINK = configBody.children[1].children[1].children[2] as HTMLElement;
    this.UNIT_DISTANCE = configBody.children[2].children[0].children[1] as HTMLInputElement;
    this.ORIGIN = configBody.children[3].children[0].lastElementChild as HTMLInputElement;
    this.LINE_THICKNESS = configBody.children[1].lastElementChild?.children[1] as HTMLInputElement;
    this.LINE_THICKNESS_TEXT = configBody.children[1].lastElementChild?.lastElementChild as HTMLElement;
    this.TRAJECTORY_THICKNESS = configBody.children[2].lastElementChild?.children[1] as HTMLInputElement;
    this.TRAJECTORY_THICKNESS_TEXT = configBody.children[2].lastElementChild?.lastElementChild as HTMLElement;
    this.POINT_SIZE = configBody.children[3].lastElementChild?.children[1] as HTMLInputElement;
    this.POINT_SIZE_TEXT = configBody.children[3].lastElementChild?.lastElementChild as HTMLElement;

    // Unit conversion for distance
    this.UNIT_DISTANCE.addEventListener("change", () => {
      let newUnit = this.UNIT_DISTANCE.value;
      if (newUnit != this.lastUnitDistance) {
        let oldLineSize = Number(this.LINE_THICKNESS.value);
        let oldTrajectorySize = Number(this.TRAJECTORY_THICKNESS.value);
        let oldPointSize = Number(this.POINT_SIZE.value);
        if (newUnit == "meters") {
          this.LINE_THICKNESS.value = (Math.round(convert(oldLineSize, "inches", "meters") * 1000) / 1000).toString();
          this.LINE_THICKNESS.step = "0.01";
          this.TRAJECTORY_THICKNESS.value = (
            Math.round(convert(oldTrajectorySize, "inches", "meters") * 1000) / 1000
          ).toString();
          this.TRAJECTORY_THICKNESS.step = "0.01";
          this.POINT_SIZE.value = (Math.round(convert(oldPointSize, "inches", "meters") * 1000) / 1000).toString();
          this.POINT_SIZE.step = "0.01";
        } else {
          this.LINE_THICKNESS.value = (Math.round(convert(oldLineSize, "meters", "inches") * 100) / 100).toString();
          this.LINE_THICKNESS.step = "1";
          this.TRAJECTORY_THICKNESS.value = (
            Math.round(convert(oldTrajectorySize, "meters", "inches") * 100) / 100
          ).toString();
          this.TRAJECTORY_THICKNESS.step = "1";
          this.POINT_SIZE.value = (Math.round(convert(oldPointSize, "meters", "inches") * 100) / 100).toString();
          this.POINT_SIZE.step = "1";
        }
        this.LINE_THICKNESS_TEXT.innerText = newUnit;
        this.TRAJECTORY_THICKNESS_TEXT.innerText = newUnit;
        this.POINT_SIZE_TEXT.innerText = newUnit;
        this.lastUnitDistance = newUnit;
      }
    });

    // Bind source link
    this.GAME.addEventListener("change", () => {
      let config = window.assets?.field2ds.find((game) => game.name === this.GAME.value);
      this.GAME_SOURCE_LINK.hidden = config !== undefined && config.sourceUrl === undefined;
    });
    this.GAME_SOURCE_LINK.addEventListener("click", () => {
      window.sendMainMessage(
        "open-link",
        window.assets?.field2ds.find((game) => game.name === this.GAME.value)?.sourceUrl
      );
    });

    // Enforce side length range
    this.LINE_THICKNESS.addEventListener("change", () => {
      if (Number(this.LINE_THICKNESS.value) <= 0) this.LINE_THICKNESS.value = "0.01";
    });
    this.TRAJECTORY_THICKNESS.addEventListener("change", () => {
      if (Number(this.TRAJECTORY_THICKNESS.value) <= 0) this.TRAJECTORY_THICKNESS.value = "0.01";
    });
    this.POINT_SIZE.addEventListener("change", () => {
      if (Number(this.POINT_SIZE.value) <= 0) this.POINT_SIZE.value = "0.01";
    });
  }

  /** Clears all options from the game selector then updates it with the latest options. */
  private resetGameOptions() {
    let value = this.GAME.value;
    while (this.GAME.firstChild) {
      this.GAME.removeChild(this.GAME.firstChild);
    }
    let options: string[] = [];
    if (window.assets !== null) {
      options = window.assets.field2ds.map((game) => game.name);
      options.forEach((title) => {
        let option = document.createElement("option");
        option.innerText = title;
        this.GAME.appendChild(option);
      });
    }
    if (options.includes(value)) {
      this.GAME.value = value;
    } else {
      this.GAME.value = options[0];
    }
    this.updateGameSourceLink();
  }

  private updateGameSourceLink() {
    let fieldConfig = window.assets?.field2ds.find((game) => game.name === this.GAME.value);
    this.GAME_SOURCE_LINK.hidden = fieldConfig !== undefined && fieldConfig.sourceUrl === undefined;
  }

  get options(): { [id: string]: any } {
    return {
      game: this.GAME.value,
      unitDistance: this.UNIT_DISTANCE.value,
      origin: this.ORIGIN.value,
      lineThickness: Number(this.LINE_THICKNESS.value),
      trajectoryThickness: Number(this.TRAJECTORY_THICKNESS.value),
      pointSize: Number(this.POINT_SIZE.value)
    };
  }

  set options(options: { [id: string]: any }) {
    this.lastOptions = options;
    this.GAME.value = options.game;
    this.UNIT_DISTANCE.value = options.unitDistance;
    this.ORIGIN.value = options.origin;
    this.LINE_THICKNESS.value = options.lineThickness;
    this.LINE_THICKNESS_TEXT.innerText = options.unitDistance;
    this.TRAJECTORY_THICKNESS.value = options.trajectoryThickness;
    this.TRAJECTORY_THICKNESS_TEXT.innerText = options.unitDistance;
    this.POINT_SIZE.value = options.pointSize;
    this.POINT_SIZE_TEXT.innerText = options.unitDistance;
    this.lastUnitDistance = options.unitDistance;
    this.updateGameSourceLink();
  }

  newAssets() {
    this.resetGameOptions();
  }

  getAdditionalActiveFields(): string[] {
    return [];
  }

  getCommand(time: number) {
    let fields = this.getListFields()[0];

    // Returns the current value for a field
    let getCurrentValue = (key: string): Pose2d[] => {
      let logData = window.log.getNumberArray(key, time, time);
      if (
        logData &&
        logData.timestamps[0] <= time &&
        (logData.values[0].length == 2 || logData.values[0].length % 3 == 0)
      ) {
        let poses: Pose2d[] = [];
        if (logData.values[0].length == 2) {
          poses.push({
            translation: [
              convert(logData.values[0][0], this.UNIT_DISTANCE.value, "meters"),
              convert(logData.values[0][1], this.UNIT_DISTANCE.value, "meters")
            ],
            rotation: 0
          });
        } else {
          for (let i = 0; i < logData.values[0].length; i += 3) {
            poses.push({
              translation: [
                convert(logData.values[0][i], this.UNIT_DISTANCE.value, "meters"),
                convert(logData.values[0][i + 1], this.UNIT_DISTANCE.value, "meters")
              ],
              rotation: 0
            });
          }
        }
        return poses;
      } else {
      }
      return [];
    };

    // Get data
    let pointsData: Pose2d[] = [];
    let linesData: Pose2d[][][] = [];
    let trajectoryData: Pose2d[][] = [];
    fields.forEach((field) => {
      switch (field.type) {
        case "Points":
          pointsData = pointsData.concat(getCurrentValue(field.key));
          break;
        case "Lines":
          let data = getCurrentValue(field.key);
          let dataParsed: Pose2d[][] = [];
          for (let i = 0; i < data.length; i += 2) {
            let line = data.slice(i, i + 2);
            if (line.length == 2) dataParsed.push(line);
          }
          linesData = linesData.concat(dataParsed);
          break;
        case "Trajectory":
          trajectoryData.push(getCurrentValue(field.key));
          break;
      }
    });

    // Package command data
    return {
      poses: {
        trajectory: trajectoryData,
        lines: linesData,
        points: pointsData
      },
      options: this.options
    };
  }
}
