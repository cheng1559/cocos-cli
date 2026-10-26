import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

const mockRunXcodeBuild = jest.fn();
jest.mock('../platforms/native-common/pack-tool/utils', () => ({
    cchelper: {}, toolHelper: {
        runXcodeBuild: (...args: unknown[]) => mockRunXcodeBuild(...args),
    },
}));
jest.mock('../platforms/native-common/pack-tool/platforms/mac-os', () => ({
    MacOSPackTool: class {
        params: any;
        getIosSimulatorArch() { return 'arm64'; }
        getExecutableNameOrDefault() { return this.params.executableName; }
    },
}));

import IOSPackTool from '../platforms/native-common/pack-tool/platforms/ios';

let root: string;
beforeEach(async () => {
    jest.clearAllMocks();
    mockRunXcodeBuild.mockResolvedValue(undefined);
    root = await fs.mkdtemp(path.join(os.tmpdir(), "cocos ios 'make-"));
    await fs.ensureDir(path.join(root, 'proj'));
});
afterEach(async () => { await fs.remove(root); });

function fixture(teamid?: string, simulator = false, iphoneos = true) {
    const tool = new IOSPackTool();
    tool.params = { debug: false, projectName: 'game', executableName: 'game-mobile',
        platformParams: { teamid, simulator, iphoneos } } as any;
    tool.paths = { buildDir: root, nativePrjDir: path.join(root, 'proj') } as any;
    const pack = jest.spyOn(tool as any, 'packageIpa').mockResolvedValue(undefined);
    return { tool, pack };
}

test.each([
    ['project', undefined], ['workspace', undefined],
    ['project', 'TEAM123'], ['workspace', 'TEAM123'],
])('%s device build with team %s packages an IPA with the selected signing mode', async (kind, teamid) => {
    if (kind === 'workspace') await fs.ensureDir(path.join(root, 'proj/game.xcworkspace'));
    const { tool, pack } = fixture(teamid);
    await expect(tool.make()).resolves.toBe(true);
    const compiler = mockRunXcodeBuild;
    expect(compiler).toHaveBeenCalledTimes(1);
    const command = compiler.mock.calls[0][0].join(' ');
    expect(command).toContain(kind === 'workspace' ? '-workspace' : '-project');
    expect(command).toContain('generic/platform=');
    expect(command).not.toContain('-arch');
    if (teamid) {
        expect(command).toContain('DEVELOPMENT_TEAM=');
        expect(command).toContain('-allowProvisioningUpdates');
        expect(command).not.toContain('CODE_SIGNING_ALLOWED=NO');
    } else {
        expect(command).toContain('CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO');
        expect(command).not.toContain('DEVELOPMENT_TEAM=');
        expect(command).not.toContain('-allowProvisioningUpdates');
    }
    expect(pack).toHaveBeenCalledWith(!teamid);
});

test('simulator-only builds do not package a device IPA', async () => {
    const { tool, pack } = fixture(undefined, true, false);
    await tool.make();
    expect(mockRunXcodeBuild.mock.calls[0][0]).toContain('iphonesimulator');
    expect(mockRunXcodeBuild.mock.calls[0][0]).toContain('ARCHS=arm64');
    expect(pack).not.toHaveBeenCalled();
});

test('failed compilation cannot publish an IPA from a previous app', async () => {
    const { tool, pack } = fixture();
    mockRunXcodeBuild.mockRejectedValue(new Error('compiler failed'));
    await expect(tool.make()).rejects.toThrow('compiler failed');
    expect(pack).not.toHaveBeenCalled();
});
