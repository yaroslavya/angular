library angular2.src.alt_router.link;

import "segments.dart" show Tree, TreeNode, UrlSegment, RouteSegment, rootNode;
import "package:angular2/src/facade/lang.dart"
    show isBlank, isString, isStringMap;
import "package:angular2/src/facade/collection.dart" show ListWrapper;

Tree<UrlSegment> link(
    RouteSegment segment, Tree<UrlSegment> tree, List<dynamic> change) {
  if (identical(change.length, 0)) return tree;
  var normalizedChange = (identical(change.length, 1) && change[0] == "/")
      ? change
      : (new List.from(["/"])..addAll(change));
  return new Tree<UrlSegment>(_update(rootNode(tree), normalizedChange));
}

TreeNode<UrlSegment> _update(TreeNode<UrlSegment> node, List<dynamic> changes) {
  var rest = ListWrapper.slice(changes, 1);
  var outlet = _outlet(changes);
  var segment = _segment(changes);
  if (isString(segment) && segment[0] == "/") segment = segment.substring(1);
  // reach the end of the tree => create new tree nodes.
  if (isBlank(node)) {
    var urlSegment = new UrlSegment(segment, null, outlet);
    var children = identical(rest.length, 0) ? [] : [_update(null, rest)];
    return new TreeNode<UrlSegment>(urlSegment, children);
  } else if (outlet != node.value.outlet) {
    return node;
  } else {
    var urlSegment = isStringMap(segment)
        ? new UrlSegment(null, segment, null)
        : new UrlSegment(segment, null, outlet);
    if (identical(rest.length, 0)) {
      return new TreeNode<UrlSegment>(urlSegment, []);
    }
    return new TreeNode<UrlSegment>(
        urlSegment, _updateMany(ListWrapper.clone(node.children), rest));
  }
}

List<TreeNode<UrlSegment>> _updateMany(
    List<TreeNode<UrlSegment>> nodes, List<dynamic> changes) {
  var outlet = _outlet(changes);
  var nodesInRightOutlet =
      nodes.where((c) => c.value.outlet == outlet).toList();
  if (nodesInRightOutlet.length > 0) {
    var nodeRightOutlet = nodesInRightOutlet[0];
    nodes[nodes.indexOf(nodeRightOutlet)] = _update(nodeRightOutlet, changes);
  } else {
    nodes.add(_update(null, changes));
  }
  return nodes;
}

dynamic _segment(List<dynamic> changes) {
  if (!isString(changes[0])) return changes[0];
  var parts = changes[0].toString().split(":");
  return parts.length > 1 ? parts[1] : changes[0];
}

String _outlet(List<dynamic> changes) {
  if (!isString(changes[0])) return null;
  var parts = changes[0].toString().split(":");
  return parts.length > 1 ? parts[0] : null;
}
