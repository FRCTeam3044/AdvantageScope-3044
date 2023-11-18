import { TabState } from "../../shared/HubState";
import TabType from "../../shared/TabType";
import TabController from "../TabController";

export default class CoprocessorsController implements TabController {
  private CONTAINER: HTMLElement;

  constructor(content: HTMLElement) {
    this.CONTAINER = content.getElementsByClassName("documentation-container")[0] as HTMLElement;
  }

  saveState(): TabState {
    return {
      type: TabType.Coprocessors
    };
  }

  restoreState(state: TabState) {}

  refresh() {}

  newAssets() {}

  getActiveFields(): string[] {
    return [];
  }

  periodic() {}
}
