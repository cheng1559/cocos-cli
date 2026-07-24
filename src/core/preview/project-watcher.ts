import { existsSync, FSWatcher, statSync, watch } from 'fs';
import { join } from 'path';
import { assetManager } from '../assets';

let watcher: FSWatcher | undefined;
let timer: NodeJS.Timeout | undefined;
let refreshing = false;
const changedPaths = new Set<string>();

function scheduleRefresh(assetsPath: string, filename: string | Buffer | null): void {
    if (filename?.toString().endsWith('.meta')) {
        return;
    }
    const changedPath = filename ? join(assetsPath, filename.toString()) : assetsPath;
    try {
        if (filename && statSync(changedPath).isDirectory()) {
            return;
        }
    } catch {
        // Deleted files still need to be removed from the asset database.
    }
    changedPaths.add(changedPath);
    if (timer) {
        clearTimeout(timer);
    }
    timer = setTimeout(() => void flushRefreshes(), 100);
}

async function flushRefreshes(): Promise<void> {
    timer = undefined;
    if (refreshing) {
        return;
    }

    refreshing = true;
    const paths = [...changedPaths];
    changedPaths.clear();
    for (const path of paths) {
        try {
            await assetManager.refreshAsset(path);
        } catch (error) {
            console.error(`[Preview] Failed to refresh changed asset ${path}:`, error);
        }
    }
    refreshing = false;
    if (changedPaths.size > 0) {
        timer = setTimeout(() => void flushRefreshes(), 100);
    }
}

export function registerProjectWatcher(projectPath: string): void {
    if (watcher) {
        return;
    }

    const assetsPath = join(projectPath, 'assets');
    if (!existsSync(assetsPath)) {
        return;
    }

    watcher = watch(assetsPath, { recursive: true }, (_event, filename) => {
        scheduleRefresh(assetsPath, filename);
    });
    watcher.on('error', (error) => {
        console.error('[Preview] Project watcher failed:', error);
    });
}

export function unregisterProjectWatcher(): void {
    watcher?.close();
    watcher = undefined;
    if (timer) {
        clearTimeout(timer);
        timer = undefined;
    }
    changedPaths.clear();
}
