#!/usr/bin/env python3
"""Independently implemented Python verifier for the JS interval witness.
Standard library only. Recomputes Picard inclusion, a Lipschitz bound, and
finite Taylor remainder enclosures without executing/importing the producer.
Not a Lean/Isabelle formal proof.
Usage: python verify_certificate.py certificate.json [more.json ...]
"""
from __future__ import annotations
import json
import sys
from fractions import Fraction
from math import isqrt
from pathlib import Path
BITS = 192
S = 2**BITS
ZERO = (0, 0)
ONE = (S, S)
PAIRS = ((0, 1), (0, 2), (1, 2))
def ceildiv(a: int, b: int) -> int: return -((-a) // b)
def number(q):
    q = Fraction(q)
    return q.numerator*S//q.denominator, ceildiv(q.numerator*S, q.denominator)
def add(a, b): return a[0]+b[0], a[1]+b[1]
def sub(a, b): return a[0]-b[1], a[1]-b[0]
def neg(a): return -a[1], -a[0]
def mul(a, b):
    p = [x*y for x in a for y in b]
    return min(p)//S, ceildiv(max(p), S)
def div(a, b):
    if b[0] <= 0 <= b[1]: raise ValueError('interval division by zero')
    # Different signed-division implementation: exact rational quotients.
    q = [Fraction(x*S, y) for x in a for y in b]
    low, high = min(q), max(q)
    return low.numerator//low.denominator, ceildiv(high.numerator, high.denominator)
def square(a):
    p = [x*x for x in a]
    return (0 if a[0] <= 0 <= a[1] else min(p)//S, ceildiv(max(p), S))
def root(a):
    if a[0] < 0: raise ValueError('negative square root')
    l, h = isqrt(a[0]*S), isqrt(a[1]*S)
    return l, h + (h*h != a[1]*S)
def subset(a, b, strict=False):
    return b[0] < a[0] <= a[1] < b[1] if strict else b[0] <= a[0] <= a[1] <= b[1]
def intersect(a, b):
    c = max(a[0], b[0]), min(a[1], b[1])
    if c[0] > c[1]: raise ValueError('disjoint enclosures')
    return c

def geometry(y):
    for i, j in PAIRS:
        d = [sub(y[2*j+k], y[2*i+k]) for k in range(2)]
        s = add(square(d[0]), square(d[1]))
        if s[0] <= 0: raise ValueError('collision-free box not certified')
        r = root(s)
        if r[0] <= 0: raise ValueError('rounded distance lower bound is zero')
        yield i, j, d, r, div(ONE, mul(s, r))

def vector_field(y, m):
    f = list(y[6:]) + [ZERO]*6
    for i, j, d, _, b in geometry(y):
        for k in range(2):
            g = mul(d[k], b)
            f[6+2*i+k] = add(f[6+2*i+k], mul(m[j], g))
            f[6+2*j+k] = sub(f[6+2*j+k], mul(m[i], g))
    return f

def lipschitz(y, m):
    sums = [ZERO]*3
    distances = []
    for i, j, d, r, b in geometry(y):
        sums[i] = add(sums[i], mul(m[j], b))
        sums[j] = add(sums[j], mul(m[i], b))
        distances.append(r[0])
    return max(S, 8*max(s[1] for s in sums)), min(distances)

def coeffs(y, m, degree):
    """Rebuild normalized position derivatives from the stated recurrence."""
    a = [list(y[:6]), list(y[6:])] + [[ZERO]*6 for _ in range(degree-1)]
    d = {pair: [] for pair in PAIRS}
    s = {pair: [] for pair in PAIRS}
    b = {pair: [] for pair in PAIRS}
    for n in range(degree-1):
        for pair in PAIRS:
            i, j = pair
            d[pair].append([sub(a[n][2*j+k], a[n][2*i+k]) for k in (0, 1)])
            if n == 0:
                sn = add(square(d[pair][0][0]), square(d[pair][0][1]))
            else:
                sn = ZERO
                for k in range(n+1):
                    for z in (0, 1):
                        sn = add(sn, mul(d[pair][k][z], d[pair][n-k][z]))
            s[pair].append(sn)
            if n == 0:
                bn = div(ONE, mul(sn, root(sn)))
            else:
                total = ZERO
                for k in range(1, n+1):
                    total = add(total, mul(number(2*n+k), mul(s[pair][k], b[pair][n-k])))
                bn = neg(div(total, mul(number(2*n), s[pair][0])))
            b[pair].append(bn)
            for z in (0, 1):
                force = ZERO
                for k in range(n+1):
                    force = add(force, mul(d[pair][k][z], b[pair][n-k]))
                force = div(force, number((n+1)*(n+2)))
                a[n+2][2*i+z] = add(a[n+2][2*i+z], mul(m[j], force))
                a[n+2][2*j+z] = sub(a[n+2][2*j+z], mul(m[i], force))
    return a

def endpoint(y, m, h, box, order, f):
    a, b = coeffs(y, m, order), coeffs(box, m, order+1)
    hp = ONE
    for _ in range(order): hp = mul(hp, h)
    result = []
    for component in range(12):
        k = component % 6
        v = ZERO
        for n in reversed(range(order)):
            c = a[n][k] if component < 6 else mul(number(n+1), a[n+1][k])
            v = add(mul(v, h), c)
        remainder = b[order][k] if component < 6 else mul(number(order+1), b[order+1][k])
        v = add(v, mul(hp, remainder))
        result.append(intersect(v, add(y[component], mul(h, f[component]))))
    return result

def box_from_json(x):
    if not isinstance(x, list) or len(x) != 12: raise ValueError('invalid box dimension')
    out = []
    for ab in x:
        if not isinstance(ab, list) or len(ab) != 2 or any(not isinstance(v, str) or len(v)>200 for v in ab):
            raise ValueError('invalid interval endpoint')
        a, b = map(int, ab)
        if a > b: raise ValueError('reversed interval')
        out.append((a,b))
    return out

def outward_decimal(x, digits=24, up=False):
    v = ceildiv(x*10**digits, S) if up else x*10**digits//S
    a = str(abs(v)).zfill(digits+1)
    return ('-' if v < 0 else '') + a[:-digits] + '.' + a[-digits:]

def verify(c):
    if c.get('schema') not in ('three-body-interval-certificate-1', 'three-body-interval-certificate-2') or c.get('bits') != BITS:
        raise ValueError('unsupported certificate')
    inp = c['input']
    if str(inp.get('G', '1')) != '1' or Fraction(inp.get('epsilon', '0')) != 0:
        raise ValueError('wrong physical model')
    y = [number(v) for v in inp['state']]
    m = [number(v) for v in inp['masses']]
    if len(y) != 12 or len(m) != 3 or any(a <= 0 for a,b in m): raise ValueError('invalid state or mass')
    T = Fraction(inp['T'])
    order = inp['order']
    if not 0 < T <= 2 or type(order) is not int or not 4 <= order <= (28 if c.get('schema') == 'three-body-interval-certificate-2' else 16): raise ValueError('invalid integration parameters')
    steps = c['steps']
    if not isinstance(steps, list) or len(steps)>2048: raise ValueError('proof budget')
    t, dmin, qmax = Fraction(0), None, 0
    for i, step in enumerate(steps):
        hr = Fraction(*map(int, step['h']))
        if hr <= 0 or t+hr > T: raise ValueError(f'invalid time step {i}')
        h, X, nxt = number(hr), box_from_json(step['tube']), box_from_json(step['end'])
        f = vector_field(X, m)
        im = [add(yy, mul((0,h[1]), ff)) for yy,ff in zip(y,f)]
        if not all(subset(v,x,True) for v,x in zip(im,X)): raise ValueError(f'Picard inclusion failed at step {i}')
        L, distance = lipschitz(X, m)
        if c['schema'] == 'three-body-interval-certificate-2': L = root((L, L))[1]
        q = ceildiv(h[1]*L, S)
        if q >= S: raise ValueError(f'no contraction at step {i}')
        computed = endpoint(y,m,h,X,order,f)
        if not all(subset(v,x) for v,x in zip(computed,nxt)): raise ValueError(f'Taylor endpoint not enclosed at step {i}')
        t += hr
        y = nxt
        dmin = distance if dmin is None else min(dmin,distance)
        qmax = max(qmax,q)
    if Fraction(*map(int,c['reached'])) != t or c['complete'] != (t==T): raise ValueError('time or completion claim mismatch')
    return {'verified':True, 'complete':t==T, 'steps':len(steps), 'reached':str(t),
            'minDistanceLower': None if dmin is None else outward_decimal(dmin),
            'contractionUpper':outward_decimal(qmax,up=True),
            'endpoint':[[outward_decimal(a),outward_decimal(b,up=True)] for a,b in y],
            'maxPositionWidth': max((b-a)/S for a,b in y[:6]),
            'maxStateWidth':max((b-a)/S for a,b in y)}

def main():
    if len(sys.argv)<2: raise SystemExit('Usage: python verify_certificate.py certificate.json [...]')
    results = []
    for name in sys.argv[1:]:
        with open(name, encoding='utf-8') as f: c=json.load(f)
        result=verify(c)
        result['file']=Path(name).name
        results.append(result)
    print(json.dumps(results,ensure_ascii=False,indent=2))
if __name__ == '__main__':
    try: main()
    except (ValueError,KeyError,TypeError,ZeroDivisionError) as exc:
        raise SystemExit(f'REJECTED: {exc}') from exc
