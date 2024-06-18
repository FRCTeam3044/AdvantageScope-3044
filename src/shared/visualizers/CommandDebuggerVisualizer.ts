import Visualizer from "./Visualizer";

export default class MechanismVisualizer implements Visualizer {
  private CONTAINER: HTMLUListElement;

  constructor(container: HTMLUListElement) {
    this.CONTAINER = container;
  }

  saveState() {
    return null;
  }

  restoreState(): void {}

  render(commands: string[]): number | null {
    this.CONTAINER.innerHTML = "";
    // Commands can be like "rootCommand" or "rootCommand/subCommand/subCommand", display them as a list where children are indented and nested properly under there parent
    // the commands array is not ordered properly
    let commandsMap: { [command: string]: string[] } = {};
    let rootCommands: string[] = [];
    commands.forEach((command) => {
      let split = command.split("/");
      if (split.length === 1) {
        rootCommands.push(command);
      } else {
        if (commandsMap[split[0]] === undefined) {
          commandsMap[split[0]] = [];
        }
        commandsMap[split[0]].push(split.slice(1).join("/"));
      }
    });

    let renderCommand = (command: string, depth: number) => {
      let li = document.createElement("li");
      li.innerText = command;
      li.style.paddingLeft = `${depth * 20 + 10}px`;
      li.className = depth % 2 === 0 ? "debug-command command-dark" : "debug-command command-light";
      this.CONTAINER.appendChild(li);

      if (commandsMap[command] !== undefined) {
        commandsMap[command].forEach((subCommand) => {
          renderCommand(subCommand, depth + 1);
        });
      }
    };

    rootCommands.forEach((command) => {
      renderCommand(command, 0);
    });

    return null;
  }
}
