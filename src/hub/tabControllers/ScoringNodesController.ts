import LoggableType from "../../shared/log/LoggableType"
import TabType from "../../shared/TabType";
import TimelineVizController from "./TimelineVizController";
import ScoringNodesVisualizer from "../../shared/visualizers/ScoringNodesVisualizer";

export default class ScoringNodesController extends TimelineVizController {
  getAdditionalActiveFields(): string[] {
    return [];
  }
  get options(): { [id: string]: any } {
    return {};
  }
  set options(options: { [id: string]: any }) {}
  getCommand(time: number) {
    return null;
  }

  constructor(content: HTMLElement) {
    super(
      content,
      TabType.ScoringNodes,
      [],
      [
        {
          element: content.getElementsByClassName("timeline-viz-config")[0].firstElementChild?.children[1]
            .firstElementChild as HTMLElement,
          types: [LoggableType.NumberArray],
          options: [
            ["Robot", "Ghost", "Trajectory", "Vision Target", "Arrow (Front)", "Arrow (Center)", "Arrow (Back)"]
          ]
        }
      ],
      new ScoringNodesVisualizer(content.getElementsByClassName("scoring-table")[0] as HTMLElement)
    );
  }
}
