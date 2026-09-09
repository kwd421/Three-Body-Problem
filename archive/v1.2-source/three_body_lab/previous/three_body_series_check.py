#!/usr/bin/env python3
"""Local Taylor-series construction for the Newtonian three-body problem.

Run:
    python -m pip install numpy scipy
    python three_body_series_check.py

NumPy is required; SciPy is used only for independent numerical checks.

This is a local-series demonstration, not a new closed-form general solution
and not a production adaptive integrator. It does not certify a convergence
radius, truncation error, or collision-free interval. Do not evaluate a single
polynomial at arbitrarily large times. Numerical agreement between methods is
not a rigorous error bound. No force softening is used.

Mathematics (a[n,i] is a Taylor coefficient, not an unscaled derivative):
    d[n,i,j] = a[n,j] - a[n,i]
    s[n,i,j] = sum_k d[k,i,j] . d[n-k,i,j]
    b[0,i,j] = s[0,i,j]**(-3/2)
    b[n,i,j] = -sum_{k=1}^n (n+k/2)*s[k,i,j]*b[n-k,i,j]
                 / (n*s[0,i,j])
    a[n+2,i] = G*sum_{j!=i} m[j]*sum_{k=0}^n d[k,i,j]*b[n-k,i,j]
                 / ((n+1)*(n+2))

The b recurrence follows from s*b' = -(3/2)*s'*b. The acceleration
recurrence follows by equating coefficients in Newton's equations.

Background (not a claim of novelty):
    Pal & Suli (2007), https://arxiv.org/abs/0707.3454
    Henkel (2002), https://arxiv.org/abs/physics/0203001
"""
from __future__ import annotations

import math
import sys

try:
    import numpy as np
except ImportError as exc:
    raise SystemExit("NumPy is required. Run: python -m pip install numpy scipy") from exc


def validate_inputs(r0, v0, masses, order: int, G: float):
    """Accept exactly three bodies, in two or three spatial dimensions."""
    r0 = np.asarray(r0, dtype=float)
    v0 = np.asarray(v0, dtype=float)
    masses = np.asarray(masses, dtype=float)
    if r0.shape not in ((3, 2), (3, 3)) or v0.shape != r0.shape:
        raise ValueError("r0 and v0 must both have shape (3, 2) or (3, 3)")
    if masses.shape != (3,) or not np.all(np.isfinite(masses)) or np.any(masses <= 0):
        raise ValueError("masses must contain three finite positive values")
    if not np.all(np.isfinite(r0)) or not np.all(np.isfinite(v0)):
        raise ValueError("positions and velocities must be finite")
    if isinstance(order, bool) or not isinstance(order, (int, np.integer)) or order < 2:
        raise ValueError("order must be an integer >= 2")
    if not math.isfinite(G) or G <= 0:
        raise ValueError("G must be finite and positive")
    for i in range(3):
        for j in range(i + 1, 3):
            if not np.linalg.norm(r0[j] - r0[i]) > 0:
                raise ValueError("initial positions must be distinct (no initial collision)")
    return r0, v0, masses


def taylor_coefficients(r0, v0, masses, order: int = 20, G: float = 1.0):
    """Return a[n,i,axis] for r_i(t)=sum_n a[n,i]*t**n near t=0.

    The coefficients are computed in ordinary floating-point arithmetic.
    Existence of a local analytic solution does not certify any particular
    requested evaluation time or finite polynomial truncation.
    """
    r0, v0, masses = validate_inputs(r0, v0, masses, order, G)
    dim = r0.shape[1]
    a = np.zeros((order + 1, 3, dim))
    a[0], a[1] = r0, v0
    d = np.zeros((order - 1, 3, 3, dim))
    s = np.zeros((order - 1, 3, 3))
    b = np.zeros_like(s)
    with np.errstate(over="raise", divide="raise", invalid="raise"):
        for n in range(order - 1):
            for i in range(3):
                for j in range(i + 1, 3):
                    d[n, i, j] = a[n, j] - a[n, i]
                    d[n, j, i] = -d[n, i, j]
                    sn = sum(np.dot(d[k, i, j], d[n-k, i, j]) for k in range(n+1))
                    s[n, i, j] = s[n, j, i] = sn
                    if n == 0:
                        bn = sn ** (-1.5)
                    else:
                        bn = -sum((n + 0.5*k)*s[k, i, j]*b[n-k, i, j]
                                  for k in range(1, n+1)) / (n*s[0, i, j])
                    b[n, i, j] = b[n, j, i] = bn
            for i in range(3):
                acc_n = np.zeros(dim)
                for j in range(3):
                    if i != j:
                        force_n = np.zeros(dim)
                        for k in range(n+1):
                            force_n += d[k, i, j]*b[n-k, i, j]
                        acc_n += G*masses[j]*force_n
                a[n+2, i] = acc_n/((n+1)*(n+2))
    if not np.all(np.isfinite(a)):
        raise FloatingPointError("non-finite Taylor coefficients; rescale or use higher precision")
    return a


def evaluate_series(a, t: float):
    """Evaluate a finite position polynomial and its derivative via Horner's rule.

    The caller is responsible for choosing a sufficiently short time interval.
    No accuracy or convergence claim follows from this function returning.
    """
    a = np.asarray(a, dtype=float)
    if a.ndim != 3 or a.shape[0] < 3 or a.shape[1] != 3 or a.shape[2] not in (2, 3):
        raise ValueError("a must have shape (order+1, 3, 2 or 3), with order >= 2")
    if not math.isfinite(t) or not np.all(np.isfinite(a)):
        raise ValueError("time and coefficients must be finite")
    r = np.zeros_like(a[0])
    v = np.zeros_like(a[0])
    with np.errstate(over="raise", invalid="raise"):
        for n in range(len(a)-1, -1, -1):
            r = r*t + a[n]
        for n in range(len(a)-1, 0, -1):
            v = v*t + n*a[n]
    return r, v


def newton_rhs(t, state, masses, dim: int, G: float = 1.0):
    """Independent direct evaluation of Newtonian acceleration, without softening."""
    r = state[:3*dim].reshape(3, dim)
    v = state[3*dim:].reshape(3, dim)
    acc = np.zeros_like(r)
    for i in range(3):
        for j in range(3):
            if i == j:
                continue
            delta = r[j] - r[i]
            distance = np.linalg.norm(delta)
            if distance == 0:
                raise ValueError("collision encountered: point-mass equation is singular")
            acc[i] += G*masses[j]*delta/distance**3
    return np.concatenate((v.ravel(), acc.ravel()))


def main() -> int:
    t = 0.1
    # Exact equilateral reference: masses=G=R=1; side length is sqrt(3).
    angles = 2*np.pi*np.arange(3)/3
    omega = 3**(-0.25)
    r_eq = np.column_stack((np.cos(angles), np.sin(angles)))
    v_eq = omega*np.column_stack((-np.sin(angles), np.cos(angles)))
    eq_coeffs = taylor_coefficients(r_eq, v_eq, [1, 1, 1])
    eq_numeric, _ = evaluate_series(eq_coeffs, t)
    eq_exact = np.column_stack((np.cos(angles+omega*t), np.sin(angles+omega*t)))
    eq_diff = float(np.max(np.abs(eq_numeric-eq_exact)))
    print(f"Equilateral reference: max position component discrepancy = {eq_diff:.6e}")
    if eq_diff > 1e-12:
        raise AssertionError("equilateral reference check failed")

    # Asymmetric example used in the answer. All quantities are dimensionless.
    masses = np.array([1., 2., 3.])
    r0 = np.array([[-1., 0.], [1., 0.], [0., 1.]])
    v0 = np.array([[0., 0.3], [0., -0.2], [-0.1, 0.]])
    coeffs = taylor_coefficients(r0, v0, masses, order=20)
    positions, velocities = evaluate_series(coeffs, t)
    print("\nAsymmetric example, G=1, t=0.1, degree=20:")
    for i in range(3):
        print(f"body {i+1}: r=({positions[i,0]: .12f}, {positions[i,1]: .12f}) "
              f"v=({velocities[i,0]: .12f}, {velocities[i,1]: .12f})")

    try:
        from scipy.integrate import solve_ivp
    except ImportError:
        print("\nSciPy is not installed: independent DOP853 checks were NOT run.")
        print("Run: python -m pip install scipy")
        return 0

    reference = solve_ivp(
        lambda time, y: newton_rhs(time, y, masses, 2),
        (0., t), np.concatenate((r0.ravel(), v0.ravel())),
        method="DOP853", rtol=3e-14, atol=1e-15, max_step=0.005,
    )
    if not reference.success:
        raise RuntimeError(reference.message)
    ref_r = reference.y[:6, -1].reshape(3, 2)
    print("\nDegree | max position component discrepancy versus DOP853")
    for degree in (4, 6, 8, 10, 12, 16, 20):
        approx, _ = evaluate_series(coeffs[:degree+1], t)
        print(f"{degree:6d} | {np.max(np.abs(approx-ref_r)):.6e}")
    discrepancy = float(np.max(np.abs(positions-ref_r)))
    if discrepancy > 1e-12:
        raise AssertionError("asymmetric reference check failed")

    # Exercise full 3D data rather than only coplanar inputs.
    rng = np.random.default_rng(20260909)
    maximum_3d_discrepancy = 0.0
    for _ in range(6):
        r3 = np.array([[-1., 0., 0.], [1., 0., 0.], [0., 1., 0.5]])
        r3 += rng.normal(scale=0.1, size=(3, 3))
        v3 = rng.normal(scale=0.2, size=(3, 3))
        m3 = rng.uniform(0.5, 2.0, size=3)
        a3 = taylor_coefficients(r3, v3, m3, order=20)
        rt, vt = evaluate_series(a3, t)
        ref = solve_ivp(
            lambda time, y: newton_rhs(time, y, m3, 3), (0., t),
            np.concatenate((r3.ravel(), v3.ravel())), method="DOP853",
            rtol=3e-14, atol=1e-15, max_step=0.005,
        )
        if not ref.success:
            raise RuntimeError(ref.message)
        diff = float(np.max(np.abs(np.concatenate((rt.ravel(), vt.ravel()))-ref.y[:, -1])))
        maximum_3d_discrepancy = max(maximum_3d_discrepancy, diff)
    print(f"\nSix short-time 3D checks: max state-component discrepancy = {maximum_3d_discrepancy:.6e}")
    if maximum_3d_discrepancy > 1e-12:
        raise AssertionError("3D reference check failed")
    print("\nThese numerical comparisons are NOT rigorous error bounds or global-solution proofs.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, RuntimeError, FloatingPointError, AssertionError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
