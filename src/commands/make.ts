import chalk from 'chalk';
import { BaseCommand } from './base';
import { BuildExitCode } from '../core/builder/@types/protected';

/**
 * Make 命令类
 */
export class MakeCommand extends BaseCommand {
    register(): void {
        this.program
            .command('make')
            .description('Make a Cocos native project (iOS device builds also generate an IPA)')
            .requiredOption('-p, --platform <platform>', 'Target platform (windows, android, ios, etc.)')
            .requiredOption('-d, --dest <path>', 'Destination path for the made project')
            .option('--developer-team <team-id>', 'Apple Developer Team ID for iOS signing')
            .action(async (options: any) => {
                try {
                    const { CocosAPI } = await import('../api/index');
                    const result = await CocosAPI.makeProject(options.platform, options.dest, options.developerTeam);
                    if (result.code === BuildExitCode.BUILD_SUCCESS) {
                        console.log(chalk.green('✓ Make completed successfully!'));
                    } else {
                        console.error(chalk.red('✗ Make failed!'));
                        process.exit(result.code);
                    }
                    process.exit(0);
                } catch (error) {
                    console.error(chalk.red('Failed to make project:'), error);
                    process.exit(1);
                }
            });
    }
}
