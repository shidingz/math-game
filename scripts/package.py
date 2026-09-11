from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root=Path(__file__).resolve().parents[1]
out=root.parent/'wukong-game-complete.zip'
with ZipFile(out,'w',ZIP_DEFLATED,compresslevel=6) as archive:
    for file in sorted(root.rglob('*')):
        if file.is_file() and not any(part.startswith('.') or part=='__pycache__' for part in file.relative_to(root).parts):
            archive.write(file,Path('wukong-game')/file.relative_to(root))
with ZipFile(out) as archive:
    assert archive.testzip() is None
    print(f'{out.name}: {len(archive.namelist())} files, {out.stat().st_size/1024/1024:.1f} MiB; archive integrity verified')
