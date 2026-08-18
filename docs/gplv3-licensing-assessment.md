# GPLv3 Relicensing Assessment

> **Status: implemented with owner authorization; not legal advice.** The
> repository's app-owned code was relicensed to GPL-3.0-only after the project
> owner authorized the change. This technical record does not establish
> copyright ownership or replace counsel; it records the conditions that must
> continue to be met in every future distribution.

## Preliminary conclusion

**GPLv3-only is now the declared license for Pocket Relay's app-owned
code, subject to the continuing conditions below.** The audited set contains GPLv3-compatible
permissive licenses, LGPL-3.0-only, MPL-2.0, CC-BY-4.0, and one dual
`(BSD-3-Clause OR GPL-2.0)` package. The owner would need to choose that
package's BSD-3-Clause alternative, rather than its GPL-2.0 alternative, and
complete the notice and source-distribution work below before making the
change.[1]

The continuing condition is important because the Git history has both `Manus` and
`Pocket Relay Maintainer` authors. Anyone changing the project license
must have the authority to relicense all **app-owned** contributions, or obtain
the contributors' permission. Third-party dependencies are not themselves
relicensed; their original licenses and notices remain in force.

## Authoritative compatibility and distribution findings

The GNU license list classifies GPLv3, LGPLv3, Apache-2.0, and modified
three-clause BSD as GPL-compatible. It expressly cautions that **GPLv2-only is
not compatible with GPLv3**. A dual-licensed component must therefore use its
GPL-compatible alternative and preserve that alternative's notice.[1]

Mozilla's MPL 2.0 terms permit an MPL-covered larger work to be additionally
distributed under GPLv3 only when the component's notices do not say
`Incompatible With Secondary Licenses` and the Section 3.3 requirements are
met. The package-level audit identifies `certifi`, `lightningcss`, and
`pathspec` as MPL-2.0; their exact distributed notices must be checked before
the license change.[1] `python-telegram-bot` is LGPL-3.0-only, which is within
the GNU list's GPLv3-compatible family. `tqdm` is MPL-2.0 **and** MIT, so its
MIT alternative should be selected where the installed package permits that.

The audit identifies `node-forge` as `(BSD-3-Clause OR GPL-2.0)`. The
BSD-3-Clause alternative must be documented as the selected license because
the GPL-2.0 alternative is not GPLv3-compatible. `caniuse-lite` is CC-BY-4.0;
its attribution and notice requirements should be preserved. Creative Commons'
published GPLv3 compatibility declaration specifically concerns CC-BY-SA 4.0,
not ordinary CC-BY-4.0, so it should not be used as the compatibility basis for
that package.[2]

GPLv3 requires the distributor of modified source to license the covered whole
under GPLv3, retain notices, mark changes, provide the GPL text, and provide
Corresponding Source for conveyed object code. When a GPLv3 program is conveyed
inside a User Product, the distributor must also provide the Installation
Information needed to install and run modified versions.[3] GNU's FAQ explains
that a private signing key is required only when the product's signature checks
would otherwise prevent modified software from functioning; it also expects
clear and convenient access to source for the exact distributed object code.[4]

For this Android app, APK signing should be reassessed before distribution. A
user-installable, locally built APK may avoid an app-controlled signature lock,
but the project should not claim compliance without reviewing its actual
distribution channel and installation path. F-Droid accepts GPL-licensed apps,
but separately requires public source, a FLOSS build process, valid asset
licenses, and dependency review.[5]

## Relicensing implementation and ongoing obligations

| Area | Required action |
|---|---|
| Copyright authority | The owner authorized this initial GPLv3 change. Maintain the contributor certification in `COPYRIGHT_POLICY.md` for every future app-owned contribution, or do not merge code lacking that authority. |
| Dependency alternatives | Record BSD-3-Clause for `node-forge`; verify MPL notices do not opt out of secondary-license compatibility; retain LGPL/MPL/MIT/CC-BY notices as applicable. |
| Source and notices | The root `LICENSE` now contains the unmodified GPLv3 text; F-Droid metadata, README, package metadata, and third-party notices have been updated. Retain all upstream license/NOTICE material. |
| Corresponding Source | Publish the exact source, lockfiles, wheel provenance, build scripts, SBOMs, and reproducible build instructions for each released APK. |
| Android installation | Document how a user builds and installs a modified APK, and re-evaluate any signature mechanism that could prevent it from running. |
| Revalidation | Regenerate SBOMs and the license audit, then run the existing test and F-Droid checks from the exact public release commit. |

## Current local evidence

`license-audit.json` records 770 accepted components with zero manual-review
and zero blocked findings. That result is a useful FOSS screen, not a substitute
for the component-level compatibility and copyright-authority checks above.

## References

[1] [GNU, *Various Licenses and Comments about Them*](https://www.gnu.org/licenses/license-list.html)

[2] [Creative Commons, *Compatible Licenses*](https://creativecommons.org/compatible-licenses/)

[3] [GNU, *GNU General Public License version 3*](https://www.gnu.org/licenses/gpl-3.0.en.html)

[4] [GNU, *GPL FAQ*](https://www.gnu.org/licenses/gpl-faq.html)

[5] [F-Droid, *Inclusion Policy*](https://f-droid.org/en/docs/Inclusion_Policy/)
