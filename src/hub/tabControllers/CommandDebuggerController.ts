import TabType from "../../shared/TabType";
import {
  Pose2d,
  Translation2d,
  logReadNumberArrayToPose2dArray,
  logReadPose2d,
  logReadPose2dArray,
  logReadTrajectoryToPose2dArray,
  logReadTranslation2dArrayToPose2dArray,
  logReadTranslation2dToPose2d,
  numberArrayToPose2dArray
} from "../../shared/geometry";
import { ALLIANCE_KEYS, getEnabledData, getIsRedAlliance, getOrDefault } from "../../shared/log/LogUtil";
import LoggableType from "../../shared/log/LoggableType";
import { convert } from "../../shared/units";
import { scaleValue } from "../../shared/util";
import CommandDebuggerVisualizer from "../../shared/visualizers/CommandDebuggerVisualizer";
import OdometryVisualizer from "../../shared/visualizers/OdometryVisualizer";
import TimelineVizController from "./TimelineVizController";

export default class CommandDebuggerController extends TimelineVizController {
  constructor(content: HTMLElement) {
    let configBody = content.getElementsByClassName("timeline-viz-config")[0].firstElementChild as HTMLElement;
    super(
      content,
      TabType.CommandDebugger,
      [
        {
          element: configBody.children[1].children[0] as HTMLElement,
          types: [LoggableType.StringArray]
        }
      ],
      [],
      new CommandDebuggerVisualizer(content.getElementsByClassName("debug-container")[0] as HTMLElement)
    );
  }

  get options(): { [id: string]: any } {
    return {};
  }

  set options(options: { [id: string]: any }) {}

  newAssets(): void {}
  getAdditionalActiveFields(): string[] {
    return [];
  }

  getCommand(time: number) {
    let fields = this.getFields();
    if (fields[0] === null) return null;
    return getOrDefault(window.log, fields[0].key, LoggableType.StringArray, time, []);
  }
}
