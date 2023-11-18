import { TabState } from "../../shared/HubState";
import TabType, { getTabIcon } from "../../shared/TabType";
import TabController from "../TabController";

export default class CoprocessorsController implements TabController {
  private CONTAINER: HTMLElement;
  private CARD_TEMPLATE: HTMLTemplateElement;

  private coprocessors: HTMLElement[] = [];

  constructor(content: HTMLElement) {
    this.CONTAINER = content.getElementsByClassName("coprocessors-container")[0] as HTMLElement;
    this.CARD_TEMPLATE = content.firstElementChild as HTMLTemplateElement;

    this.createCard("Coprocessor 1", "127.0.0.1", "pvcam1");
    this.createCard("Coprocessor 2", "127.0.0.1", "pvcam2");
    this.createCard("Coprocessor 3", "127.0.0.1", "pvcam3");
    this.createCard("Coprocessor 4", "127.0.0.1", "pvcam4");
    this.createCard("Coprocessor 5", "127.0.0.1", "pvcam5");
    this.createCard("Coprocessor 6", "127.0.0.1", "pvcam6");
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

  private createCard(name: string, ip: string, pvcam: string) {
    let card = this.CARD_TEMPLATE.cloneNode(true) as HTMLElement;
    card.classList.remove("coprocessor-card-template");
    card.getElementsByClassName("coprocessor-name")[0].textContent = name;
    card.getElementsByClassName("coprocessor-ip")[0].textContent = ip;
    card.getElementsByClassName("coprocessor-pv-cam")[0].textContent = pvcam;
    card
      .getElementsByClassName("coprocessor-pv-link")[0]
      .addEventListener("click", () => window.sendMainMessage("open-link", `http://${ip}:5800`));
    this.coprocessors.push(card);
    this.CONTAINER.appendChild(card);
  }

  private changeTabColor(disconnected: boolean) {
    let tabs = Array.from(document.getElementsByClassName("tab"));
    let coprocessorTabs = tabs.filter((tab) => tab.textContent?.split(" ")[0] == getTabIcon(TabType.Coprocessors));
    coprocessorTabs.forEach((tab) => {
      if (disconnected) {
        tab.classList.add("disconnected-tab");
      } else {
        tab.classList.remove("disconnected-tab");
      }
    });
  }
}
