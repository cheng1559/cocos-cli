import { access, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { ModLo } from '@cocos/creator-programming-mod-lo';
import { QuickPack } from '../packer-driver/quick-pack';

test('restarting with missing cached chunks recompiles unchanged modules', async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'cocos-pack-missing-chunk-')));
    try {
        const entry = pathToFileURL(join(root, 'entry.mjs'));
        await writeFile(join(root, 'entry.mjs'), `export { value } from './dependency.mjs';`);
        await writeFile(join(root, 'dependency.mjs'), `export const value = 42;`);
        const options = { modLo: new ModLo({ _compressUUID: value => value }), origin: root, workspace: join(root, 'output') };
        await mkdir(options.workspace);
        await new QuickPack(options).build([entry]);
        const map = JSON.parse(await readFile(join(options.workspace, 'import-map.json'), 'utf8'));
        const chunk = join(options.workspace, Object.values(map.scopes[map.imports[entry.href]])[0] as string);
        await rm(chunk);
        const restarted = new QuickPack(options);
        await restarted.loadCache();
        await restarted.build([entry]);
        await expect(access(chunk)).resolves.toBeUndefined();
        expect(await readFile(chunk, 'utf8')).toContain('42');
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test('a failed module build cannot shift cached dependency targets on recovery', async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'cocos-pack-recovery-')));
    try {
        const entry = pathToFileURL(join(root, 'entry.mjs'));
        const broken = pathToFileURL(join(root, 'middle.mjs'));
        await writeFile(join(root, 'entry.mjs'), `export { first } from './first.mjs'; export { middle } from './middle.mjs'; export { last } from './last.mjs';`);
        for (const name of ['first', 'middle', 'last']) await writeFile(join(root, `${name}.mjs`), `export const ${name} = '${name}';`);
        await mkdir(join(root, 'output'));
        const modLo = new ModLo({ _compressUUID: value => value });
        const pack = new QuickPack({ modLo, origin: root, workspace: join(root, 'output') });
        await pack.build([entry]);
        // A changed dependency fails to transform; upstream cleanup removes its resolution slot.
        const timestamp = modLo.getMTimestamp.bind(modLo);
        const load = modLo.load.bind(modLo);
        let fail = true;
        jest.spyOn(modLo, 'getMTimestamp').mockImplementation(url => url.href === broken.href ? Date.now() : timestamp(url));
        jest.spyOn(modLo, 'load').mockImplementation(url => {
            if (fail && url.href === broken.href) throw Object.assign(new Error('transform failed'), { file: broken.href });
            return load(url);
        });
        await expect(pack.build([entry])).rejects.toThrow('transform failed');
        fail = false;
        await pack.build([entry]);
        const record = JSON.parse(await readFile(join(root, 'output', 'main-record.json'), 'utf8')).modules[entry.href];
        for (const [index, specifier] of record.imports.entries()) {
            expect(record.resolutions[index].resolved.url).toBe(new URL(specifier.value, entry).href);
        }
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
