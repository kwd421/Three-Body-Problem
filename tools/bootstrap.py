"""One-time lossless import of the conversation's v1.1/v1.2 source files."""
from pathlib import Path
import hashlib, io, tarfile
ROOT = Path(__file__).resolve().parent.parent
if (ROOT / 'archive/v1.2-source/three_body_lab_v1_2.html').exists():
    print('Readable archive is already present; not overwriting it.')
    raise SystemExit(0)
data = b''.join((ROOT / f'bootstrap/source.tar.xz.part{i}').read_bytes() for i in range(5))
expected = '3ec0851dca2879e60761e5c412ae81d7e6ad3f81930dbad7a5e4cdabd9a7c591'
if hashlib.sha256(data).hexdigest() != expected:
    raise SystemExit('Source snapshot checksum mismatch')
with tarfile.open(fileobj=io.BytesIO(data), mode='r:xz') as archive:
    for member in archive.getmembers():
        path = Path(member.name)
        if not member.isfile() or path.is_absolute() or '..' in path.parts or path.parts[:2] != ('archive','v1.2-source'):
            raise SystemExit('Unsafe archive entry')
        target = ROOT / path
        if target.exists(): raise SystemExit(f'Refusing to overwrite {target}')
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(archive.extractfile(member).read())
print('Restored 30 original source and documentation files; SHA-256 verified.')
