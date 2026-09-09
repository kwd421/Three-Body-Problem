# Research rules

Respond to the owner in Korean. This is an experimental planar Newtonian IVP research project, not a claimed general solution.

- Preserve exact initial conditions and unsoftened G=1 gravity in proof mode.
- Proof decisions use outward-rounded integer intervals, never floating-point plots or agreement between numerical solvers.
- Schema 1 retains the original unweighted contraction rule; schema 2 uses the documented weighted norm.
- Regenerate certificates, replay independently in Python, run exact-arithmetic and corruption tests, then build. Never silently make failed tests green.
- Preserve failed experiments and limitations. Finite-time separation is not proof of chaos; small energy drift is not a global trajectory error bound.
- Do not overwrite archive while editing current src/site. Migration scripts never overwrite existing editable files.
- Changes to a theorem require matching verifier assertions, report and website claims.
- Browser set_content tests need a fresh page per document; old animation callbacks otherwise survive. Local Chromium tests are not Safari or physical Android tests.
- No paid cloud jobs, scheduled autonomous research or external AI APIs without explicit approval. main pushes replay only the bounded documented experiment.

Current frontier: reduce interval wrapping at close encounters and extend finite-time certification with independently recheckable witnesses.
