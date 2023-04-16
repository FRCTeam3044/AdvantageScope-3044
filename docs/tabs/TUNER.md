# 🎛 Tuner

_[< Return to homepage](/docs/INDEX.md)_

The tuner is designed to allow for easy viewing of PID Graphs (or really any graph) and easy, live editing of values. It is intended for use with [OxConfig](https://github.com/FRCTeam3044/AutoConfig), and will automatically update its yaml files and controllers in real time.

After you are connected to a robot, real or sim, running the OxConfig framework, you can press the refresh button to get a list of available controllers to tune. You can select your desired controller from the dropdown.

You will see the current values of the parameters in the table.

> Note: If these are changed elsewhere while the code is running, you will need to click refresh again to see the new values

These values are editable, and will be sent to OxConfig to update the values in their respective controllers.

> Note: Values will not be sent to OxConfig until you press enter or click out of the table.
