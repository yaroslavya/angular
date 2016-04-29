import { UrlSegment, Tree } from './segments';
export declare abstract class RouterUrlSerializer {
    abstract parse(url: string): Tree<UrlSegment>;
    abstract serialize(tree: Tree<UrlSegment>): string;
}
export declare class DefaultRouterUrlSerializer extends RouterUrlSerializer {
    parse(url: string): Tree<UrlSegment>;
    serialize(tree: Tree<UrlSegment>): string;
}
