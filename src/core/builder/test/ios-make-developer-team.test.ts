import { Command } from 'commander';

const mockMakeProject = jest.fn();
const mockNativeMake = jest.fn();
jest.mock('../../../api/index', () => ({ CocosAPI: { makeProject: mockMakeProject } }));
jest.mock('../platforms/native-common/hooks', () => ({ make: mockNativeMake }));
jest.mock('cc', () => ({ ResolutionPolicy: {} }), { virtual: true });

import { MakeCommand } from '../../../commands/make';
import { make } from '../platforms/ios/src/hooks';

test('make command forwards the requested iOS team', async () => {
    mockMakeProject.mockResolvedValue({ code: 0 });
    const exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    try {
        const program = new Command();
        new MakeCommand(program).register();
        await program.parseAsync(['node', 'cocos', 'make', '--platform', 'ios', '--dest', 'build/ios', '--developer-team', 'TEAM123456']);
        expect(mockMakeProject).toHaveBeenCalledWith('ios', 'build/ios', 'TEAM123456');
    } finally {
        exit.mockRestore();
    }
});

test('iOS make applies a runtime team to the cached native options', async () => {
    mockNativeMake.mockResolvedValue(undefined);
    const options: any = { packages: { ios: { developerTeam: 'TEAM123456' } },
        cocosParams: { platformParams: { teamid: 'OLDTEAM' } } };
    await make.call({} as any, 'build/ios', options);
    expect(options.cocosParams.platformParams.teamid).toBe('TEAM123456');
    expect(mockNativeMake).toHaveBeenCalledWith('build/ios', options);

    delete options.packages.ios.developerTeam;
    options.cocosParams.platformParams.teamid = 'SAVEDTEAM';
    await make.call({} as any, 'build/ios', options);
    expect(options.cocosParams.platformParams.teamid).toBe('SAVEDTEAM');
});
