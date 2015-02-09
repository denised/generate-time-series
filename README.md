# generate-time-series

Generate fake time series

This is a sandbox for playing with the series generator from https://github.com/akngs/dgen.  Dgen is a cool package, and this only touches the surface of what it can do.

The code is currently "rough-draft" --- it works, but not all the features are implemented, and more could be added.  Feel free to help out :-)

Try it out live at http://denised.github.io/generate-time-series/

##  Priority Todo's

* Add useful time modifiers, such as weekday-only, daytime only.
* Generally improve time point generation, e.g. "monthly" should be the nth day of successive months, not 30 day increments.

## Wishes (non-priority Todo's)

* Manage seeds to make repeatable sequences.
* Add additional generators, options, from dgen
* Make it easier to control the mix of the series being combined --- perhaps simply being able to weight them, or say "more of this" or "less of that".
* Add the ability to drop out datapoints at random (mimic missing data);
* Add the ability to tweak the dataset manually: select a set of points and move them up or down, or delete them entirely.
* Undo?  I'm sure someone will be annoyed that they lost their dataset or settings...
* Integration with other tools, such as http://generatedata.com

So far I've only tested this on Chrome and IE.

