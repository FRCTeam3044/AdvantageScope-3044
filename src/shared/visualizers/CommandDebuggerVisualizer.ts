import Visualizer from "./Visualizer";

export default class MechanismVisualizer implements Visualizer {
  private CONTAINER: HTMLElement;

  constructor(container: HTMLElement) {
    this.CONTAINER = container;
  }

  saveState() {
    return null;
  }

  restoreState(): void {}

  render(command: string[]): number | null {
    return null;
  }
}
