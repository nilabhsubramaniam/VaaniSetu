// Package config loads VaaniSetu backend configuration from environment
// variables. There is no configuration file and no third-party config
// library — the surface is small enough (a handful of variables) that a
// library would be more machinery than the problem needs; see
// docs/DECISIONS.md for the project's "avoid unnecessary dependencies"
// stance. If this surface grows substantially in a later phase, revisit
// that choice explicitly rather than letting it grow silently.
package config
