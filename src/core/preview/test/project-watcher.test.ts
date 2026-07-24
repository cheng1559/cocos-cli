const mockClose = jest.fn();
const mockOn = jest.fn();
const mockWatch = jest.fn();
const mockExistsSync = jest.fn();
const mockStatSync = jest.fn();
const mockRefreshAsset = jest.fn();

jest.mock('fs', () => ({
    existsSync: mockExistsSync,
    statSync: mockStatSync,
    watch: mockWatch,
}));

jest.mock('../../assets', () => ({
    assetManager: {
        refreshAsset: mockRefreshAsset,
    },
}));

import { registerProjectWatcher, unregisterProjectWatcher } from '../project-watcher';

describe('preview project watcher', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        mockExistsSync.mockReturnValue(true);
        mockStatSync.mockReturnValue({ isDirectory: () => false });
        mockWatch.mockReturnValue({ close: mockClose, on: mockOn });
        mockRefreshAsset.mockResolvedValue(1);
        unregisterProjectWatcher();
    });

    afterEach(() => {
        unregisterProjectWatcher();
        jest.useRealTimers();
    });

    it('debounces file changes and refreshes the changed asset', async () => {
        registerProjectWatcher('C:\\project');
        const onChange = mockWatch.mock.calls[0][2];

        onChange('change', 'scripts\\Game.ts');
        onChange('change', 'scripts\\Game.ts');
        await jest.runAllTimersAsync();

        expect(mockRefreshAsset).toHaveBeenCalledTimes(1);
        expect(mockRefreshAsset).toHaveBeenCalledWith('C:\\project\\assets\\scripts\\Game.ts');
    });

    it('ignores generated metadata and directory events', async () => {
        registerProjectWatcher('C:\\project');
        const onChange = mockWatch.mock.calls[0][2];

        onChange('change', 'scripts\\Game.ts.meta');
        mockStatSync.mockReturnValue({ isDirectory: () => true });
        onChange('change', 'scripts');
        await jest.runAllTimersAsync();

        expect(mockRefreshAsset).not.toHaveBeenCalled();
    });

    it('closes the watcher when preview stops', () => {
        registerProjectWatcher('C:\\project');
        unregisterProjectWatcher();

        expect(mockClose).toHaveBeenCalledTimes(1);
    });
});
