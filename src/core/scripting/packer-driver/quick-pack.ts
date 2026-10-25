import { QuickPack as BaseQuickPack } from '@cocos/creator-programming-quick-pack/lib/quick-pack';
import { existsSync } from 'fs';
import { readJsonSync } from 'fs-extra';
import { join } from 'path';

/** Rebuild incomplete caches and recover dependency indices after failed module builds. */
export class QuickPack extends BaseQuickPack {
    override async loadCache() {
        const { workspace } = this.createLoaderContext();
        if (existsSync(join(workspace, 'main-record.json'))) {
            const mapPath = join(workspace, 'import-map.json');
            const map = existsSync(mapPath) ? readJsonSync(mapPath, { throws: false }) : null;
            const references = map ? [
                ...Object.values(map.imports ?? {}), ...Object.keys(map.scopes ?? {}),
                ...Object.values(map.scopes ?? {}).flatMap(imports => Object.values(imports as Record<string, string>)),
            ] : [];
            if (!map || references.some(file => typeof file === 'string' && file.startsWith('./chunks/') && !existsSync(join(workspace, file)))) {
                console.warn(`[QuickPack] Rebuilding incomplete script cache: ${workspace}`);
                this.clear();
                return;
            }
        }
        await super.loadCache();
    }

    override async build(specifiers: Parameters<BaseQuickPack['build']>[0], options?: Parameters<BaseQuickPack['build']>[1]) {
        try {
            return await super.build(specifiers, options);
        } catch (error) {
            // The upstream error cleanup filters the positional resolution array without its imports.
            // Clear every cached module, including entries not visited by the next incremental build.
            this.clear();
            throw error;
        }
    }
}
