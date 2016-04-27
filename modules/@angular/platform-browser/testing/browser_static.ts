import {
  APP_ID,
  NgZone,
  Provider,
  PLATFORM_COMMON_PROVIDERS,
  PLATFORM_INITIALIZER
} from '@angular/core';
import {DirectiveResolver, ViewResolver, XHR} from '@angular/compiler';
import {BROWSER_APP_COMMON_PROVIDERS} from '@angular/platform-browser';
import {BrowserDomAdapter} from '../src/browser/browser_adapter';
import {AnimationBuilder} from '../src/animate/animation_builder';
import {MockAnimationBuilder} from './animation_builder_mock';
import {MockDirectiveResolver} from '@angular/compiler/testing';
import {MockViewResolver} from '../../compiler/testing/view_resolver_mock';
import {MockLocationStrategy} from '@angular/common/testing';
import {LocationStrategy} from '@angular/common';
import {MockNgZone} from '@angular/core/testing';
import {XHRImpl} from '../../platform-browser-dynamic/src/xhr/xhr_impl';
import {TestComponentBuilder} from '@angular/compiler/testing';
import {BrowserDetection} from '@angular/platform-browser/testing';
import {Log} from '@angular/core/testing';
import {ELEMENT_PROBE_PROVIDERS} from '../src/dom/debug/ng_probe';
import {TestComponentRenderer} from '@angular/compiler/testing';
import {DOMTestComponentRenderer} from './dom_test_component_renderer';
function initBrowserTests() {
  BrowserDomAdapter.makeCurrent();
  BrowserDetection.setup();
}

/**
 * Default platform providers for testing without a compiler.
 */
export const TEST_BROWSER_STATIC_PLATFORM_PROVIDERS: Array<any /*Type | Provider | any[]*/> =
    /*@ts2dart_const*/ [
      PLATFORM_COMMON_PROVIDERS,
      {provide: PLATFORM_INITIALIZER, useValue: initBrowserTests, multi: true}
    ];

export const ADDITIONAL_TEST_BROWSER_PROVIDERS: Array<any /*Type | Provider | any[]*/> =
    /*@ts2dart_const*/ [
      {provide: APP_ID, useValue: 'a'},
      ELEMENT_PROBE_PROVIDERS,
      {provide: DirectiveResolver, useClass: MockDirectiveResolver},
      {provide: ViewResolver, useClass: MockViewResolver},
      Log,
      TestComponentBuilder,
      {provide: NgZone, useClass: MockNgZone},
      {provide: LocationStrategy, useClass: MockLocationStrategy},
      {provide: AnimationBuilder, useClass: MockAnimationBuilder},
      {provide: TestComponentRenderer, useClass: DOMTestComponentRenderer},
    ];

/**
 * Default application providers for testing without a compiler.
 */
export const TEST_BROWSER_STATIC_APPLICATION_PROVIDERS: Array<any /*Type | Provider | any[]*/> =
    /*@ts2dart_const*/ [
      BROWSER_APP_COMMON_PROVIDERS,
      {provide: XHR, useClass: XHRImpl},
      ADDITIONAL_TEST_BROWSER_PROVIDERS
    ];
