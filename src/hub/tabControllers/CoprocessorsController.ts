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
  private lastCoprocessorHeartbeats: number[] = [];
  private coprocessors: string[] = [];

  private unkownsExist: boolean = false;

  private checkHeartbeatsInterval: number = 0;

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
        this.lastCoprocessorHeartbeats.push(0);
      });
      clearInterval(this.checkHeartbeatsInterval);
      this.checkHeartbeatsInterval = window.setInterval(() => this.checkHeartbeats(), 500);
    }

    for (let cardIndex in this.coprocessorCards) {
      let card = this.coprocessorCards[cardIndex];
      let ip = card.getElementsByClassName("coprocessor-ip")[0].textContent;
      let temp = getOrDefault(window.log, `NT:/Coprocessors/${ip}/Temp`, LoggableType.Number, Infinity, "--");
      let cpu = getOrDefault(window.log, `NT:/Coprocessors/${ip}/CPU`, LoggableType.Number, Infinity, "--");
      let ram = getOrDefault(window.log, `NT:/Coprocessors/${ip}/RAM`, LoggableType.Number, Infinity, "--");
      let disk = getOrDefault(window.log, `NT:/Coprocessors/${ip}/Disk`, LoggableType.Number, Infinity, "--");
      card.getElementsByClassName("coprocessor-temp")[0].textContent = temp;
      card.getElementsByClassName("coprocessor-cpu")[0].textContent = cpu;
      card.getElementsByClassName("coprocessor-ram")[0].textContent = ram;
      card.getElementsByClassName("coprocessor-disk")[0].textContent = disk;
      let heartbeat = getOrDefault(window.log, `NT:/Coprocessors/${ip}/Heartbeat`, LoggableType.Number, Infinity, 0);
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

  private checkHeartbeats() {
    let disconnected = false;
    for (let cardIndex in this.coprocessorCards) {
      let card = this.coprocessorCards[cardIndex];
      let ip = card.getElementsByClassName("coprocessor-ip")[0].textContent;
      let heartbeat = getOrDefault(window.log, `NT:/Coprocessors/${ip}/Heartbeat`, LoggableType.Number, Infinity, 0);
      if (heartbeat <= this.lastCoprocessorHeartbeats[cardIndex]) {
        disconnected = true;
        card.classList.add("cp-disconnected");
      } else {
        card.classList.remove("cp-disconnected");
      }
      this.lastCoprocessorHeartbeats[cardIndex] = heartbeat;
    }
    this.changeTabColor(disconnected);
  }
}

interface Coprocessor {
  name: string;
  ip: string;
  pvcam: string;
}
