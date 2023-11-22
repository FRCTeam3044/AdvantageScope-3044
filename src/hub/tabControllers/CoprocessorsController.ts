import { TabState } from "../../shared/HubState";
import TabType, { getTabIcon } from "../../shared/TabType";
import { filterFieldByPrefixes, getOrDefault } from "../../shared/log/LogUtil";
import LoggableType from "../../shared/log/LoggableType";
import TabController from "../TabController";

export default class CoprocessorsController implements TabController {
  private CONTAINER: HTMLElement;
  private CARD_TEMPLATE: HTMLTemplateElement;
  private NO_COPROCESSOR_TEXT: HTMLElement;

  private coprocessorCards: HTMLElement[] = [];
  private coprocessors: string[] = [];

  private unkownsExist: boolean = false;

  constructor(content: HTMLElement) {
    this.CONTAINER = content.getElementsByClassName("coprocessors-container")[0] as HTMLElement;
    this.CARD_TEMPLATE = content.firstElementChild as HTMLTemplateElement;
    this.NO_COPROCESSOR_TEXT = content.getElementsByClassName("no-coprocessor-text")[0] as HTMLElement;
  }

  saveState(): TabState {
    return {
      type: TabType.Coprocessors
    };
  }

  restoreState(state: TabState) {}

  refresh() {
    let processorsFields = filterFieldByPrefixes(window.log.getFieldKeys(), "/Coprocessors", false, true);
    this.coprocessors = processorsFields.map((field) => field.split("/")[2]);
    this.coprocessors = this.coprocessors.filter((ip, index) => this.coprocessors.indexOf(ip) == index);

    // This is commented out because it causes the name and pvcam to be unknown
    // I suspect this is because on first refresh, the values are not available to us
    // and so we need to wait for the next refresh to get the values, but by then we've
    // already created the cards so this code doesn't run

    if (this.coprocessors.length != this.coprocessorCards.length || this.unkownsExist) {
      this.unkownsExist = false;
      for (let card of this.coprocessorCards) {
        card.remove();
      }
      this.coprocessorCards = [];
      this.coprocessors.forEach((ip) => {
        let name = getOrDefault(window.log, `NT:/Coprocessors/${ip}/Name`, LoggableType.String, Infinity, "Unknown");
        let pvcam = getOrDefault(window.log, `NT:/Coprocessors/${ip}/PVCam`, LoggableType.String, Infinity, "Unknown");
        if (name == "Unknown" || pvcam == "Unknown") {
          this.unkownsExist = true;
        }
        this.createCard(name, ip, pvcam);
      });
    }
  }

  newAssets() {}

  getActiveFields(): string[] {
    return ["NT:/Coprocessors"];
  }

  periodic() {
    if (this.coprocessorCards.length == 0) {
      this.NO_COPROCESSOR_TEXT.style.display = "block";
      if (window.isConnected()) {
        this.NO_COPROCESSOR_TEXT.children[1].textContent = "No coprocessors found on the network.";
      } else {
        this.NO_COPROCESSOR_TEXT.children[1].textContent = "You are not connected to the robot.";
      }
    } else {
      this.NO_COPROCESSOR_TEXT.style.display = "none";
    }
  }

  private createCard(name: string, ip: string, pvcam: string) {
    let card = this.CARD_TEMPLATE.cloneNode(true) as HTMLElement;
    card.classList.remove("coprocessor-card-template");
    card.getElementsByClassName("coprocessor-name")[0].textContent = name;
    card.getElementsByClassName("coprocessor-ip")[0].textContent = ip;
    card.getElementsByClassName("coprocessor-pv-cam")[0].textContent = pvcam;
    card
      .getElementsByClassName("coprocessor-pv-link")[0]
      .addEventListener("click", () => window.sendMainMessage("open-link", `http://${ip}:5800`));
    this.coprocessorCards.push(card);
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

interface Coprocessor {
  name: string;
  ip: string;
  pvcam: string;
}
