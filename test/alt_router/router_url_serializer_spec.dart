library angular2.test.alt_router.router_url_serializer_spec;

import "package:angular2/testing_internal.dart"
    show
        ComponentFixture,
        AsyncTestCompleter,
        TestComponentBuilder,
        beforeEach,
        ddescribe,
        xdescribe,
        describe,
        el,
        expect,
        iit,
        inject,
        beforeEachProviders,
        it,
        xit;
import "package:angular2/src/alt_router/router_url_serializer.dart"
    show DefaultRouterUrlSerializer;
import "package:angular2/src/alt_router/segments.dart" show UrlSegment;

main() {
  describe("url serializer", () {
    var url = new DefaultRouterUrlSerializer();
    it("should parse the root url", () {
      var tree = url.parse("/");
      expectSegment(tree.root, "");
      expect(url.serialize(tree)).toEqual("");
    });
    it("should parse non-empty urls", () {
      var tree = url.parse("one/two");
      expectSegment(tree.firstChild(tree.root), "one");
      expectSegment(tree.firstChild(tree.firstChild(tree.root)), "two");
      expect(url.serialize(tree)).toEqual("/one/two");
    });
    it("should parse multiple aux routes", () {
      var tree = url.parse("/one/two(/three//right:four)/five");
      var c = tree.children(tree.firstChild(tree.root));
      expectSegment(c[0], "two");
      expectSegment(c[1], "aux:three");
      expectSegment(c[2], "right:four");
      expectSegment(tree.firstChild(c[0]), "five");
      expect(url.serialize(tree))
          .toEqual("/one/two(aux:three//right:four)/five");
    });
    it("should parse aux routes that have aux routes", () {
      var tree = url.parse("/one(/two(/three))");
      var c = tree.children(tree.root);
      expectSegment(c[0], "one");
      expectSegment(c[1], "aux:two");
      expectSegment(c[2], "aux:three");
      expect(url.serialize(tree)).toEqual("/one(aux:two//aux:three)");
    });
    it("should parse aux routes that have children", () {
      var tree = url.parse("/one(/two/three)");
      var c = tree.children(tree.root);
      expectSegment(c[0], "one");
      expectSegment(c[1], "aux:two");
      expectSegment(tree.firstChild(c[1]), "three");
      expect(url.serialize(tree)).toEqual("/one(aux:two/three)");
    });
    it("should parse an empty aux route definition", () {
      var tree = url.parse("/one()");
      var c = tree.children(tree.root);
      expectSegment(c[0], "one");
      expect(tree.children(c[0]).length).toEqual(0);
      expect(url.serialize(tree)).toEqual("/one");
    });
    it("should parse key-value matrix params", () {
      var tree = url.parse("/one;a=11a;b=11b(/two;c=22//right:three;d=33)");
      var c = tree.firstChild(tree.root);
      expectSegment(c, "one");
      var c2 = tree.children(c);
      expectSegment(c2[0], ";a=11a;b=11b");
      expectSegment(c2[1], "aux:two");
      expectSegment(c2[2], "right:three");
      expectSegment(tree.firstChild(c2[1]), ";c=22");
      expectSegment(tree.firstChild(c2[2]), ";d=33");
      expect(url.serialize(tree))
          .toEqual("/one;a=11a;b=11b(aux:two;c=22//right:three;d=33)");
    });
    it("should parse key only matrix params", () {
      var tree = url.parse("/one;a");
      var c = tree.firstChild(tree.root);
      expectSegment(c, "one");
      expectSegment(tree.firstChild(c), ";a=true");
      expect(url.serialize(tree)).toEqual("/one;a=true");
    });
  });
}

void expectSegment(UrlSegment segment, String expected) {
  expect(segment.toString()).toEqual(expected);
}
