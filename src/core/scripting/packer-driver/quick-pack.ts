import { QuickPack as BaseQuickPack } from '@cocos/creator-programming-quick-pack/lib/quick-pack';

/** Recover dependency indices after QuickPack removes a failed module from its cached resolutions. */
export class QuickPack extends BaseQuickPack {
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
