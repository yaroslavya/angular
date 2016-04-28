library angular2.src.testing.async_test_completer;

import "dart:async";
import "package:angular2/src/facade/promise.dart" show PromiseCompleter;

/**
 * Injectable completer that allows signaling completion of an asynchronous test. Used internally.
 */
class AsyncTestCompleter {
  var _completer = new PromiseCompleter<dynamic>();
  done([dynamic value]) {
    this._completer.resolve(value);
  }

  fail([dynamic error, String stackTrace]) {
    this._completer.reject(error, stackTrace);
  }

  Future<dynamic> get promise {
    return this._completer.promise;
  }
}
