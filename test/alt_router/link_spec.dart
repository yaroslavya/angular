library angular2.test.alt_router.link_spec;

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
import "package:angular2/src/alt_router/segments.dart"
    show RouteSegment, UrlSegment, Tree;
import "package:angular2/src/alt_router/link.dart" show link;
import "package:angular2/src/alt_router/router_url_serializer.dart"
    show DefaultRouterUrlSerializer;

main() {
  describe("link", () {
    var parser = new DefaultRouterUrlSerializer();
    it("should return the original tree when given an empty array", () {
      var p = parser.parse("/");
      var t = link(s(p.root), p, []);
      expect(t).toBe(p);
    });
    it("should support going to root", () {
      var p = parser.parse("/");
      var t = link(s(p.root), p, ["/"]);
      expect(parser.serialize(t)).toEqual("");
    });
    it("should support positional params", () {
      var p = parser.parse("/");
      var t = link(s(p.root), p, ["/one", 11, "two", 22]);
      expect(parser.serialize(t)).toEqual("/one/11/two/22");
    });
    it("should preserve route siblings when changing the main route", () {
      var p = parser.parse("/a/11/b(c)");
      var t = link(s(p.root), p, ["/a", 11, "d"]);
      expect(parser.serialize(t)).toEqual("/a/11/d(aux:c)");
    });
    it("should preserve route siblings when changing a aux route", () {
      var p = parser.parse("/a/11/b(c)");
      var t = link(s(p.root), p, ["/a", 11, "aux:d"]);
      expect(parser.serialize(t)).toEqual("/a/11/b(aux:d)");
    });
    it("should update parameters", () {
      var p = parser.parse("/a;aa=11");
      var t = link(s(p.root), p, [
        "/a",
        {"aa": 22, "bb": 33}
      ]);
      expect(parser.serialize(t)).toEqual("/a;aa=22;bb=33");
    });
  });
}

RouteSegment s(UrlSegment u) {
  return new RouteSegment([u], {}, null, null, null);
}
