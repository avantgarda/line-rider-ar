(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var MapPatches = require('./MapPatches');

// We want to use a JS Map object, but also call ourselves a Map. To get 
// around this, we call this implementation ImmyMap, but export it from Immy
// as Immy.Map.
//
// Note that a key difference between this and "real" Maps is that undefined
// values aren't supported at all.

function ImmyMap(initMap) {
    if (initMap) {
        this.map = initMap;
    } else {
        this.map = null;
    }

    this.patchSource = null;
    this.patch = null;
    this.root = {};
}

ImmyMap.prototype.__getMap = function () {
  if (this.map) {
    return
  }

  if (!this.patchSource) {
    // no patch source and no map means that we're an empty list
    this.map = new Map()
    return
  }

  // first traverse out along the patch source chain to find a starting point
  // to apply patches from. because we don't store backreferences we need to
  // maintain a stack of targets to apply patches to
  var source = this.patchSource
  var targets = [this]
  while (source.patchSource) {
    targets.push(source)
    source = source.patchSource
  }

  // now work our way back down the stack and apply patches
  while (targets.length > 0) {
    var target = targets.pop()

    target.patch.apply(source.map);
    source.patchSource = target;
    source.patch = target.patch.inverse();
    target.map = source.map;
    source.map = null;
    target.patchSource = null;

    source = target
  }
};

ImmyMap.prototype.get = function (key) {
    this.__getMap();
    return this.map.get(key);
};

ImmyMap.prototype.withKeySetToValue = function (key, value) {
    this.__getMap();

    var newMap = new ImmyMap();
    newMap.map = this.map;
    this.map = null;

    this.patchSource = newMap;
    this.patch = new MapPatches.Set(key, value, newMap.map.get(key));
    newMap.map.set(key, value);

    return newMap;
};

ImmyMap.prototype.withKeyDeleted = function (key) {
    this.__getMap();

    var newMap = new ImmyMap();
    newMap.map = this.map;
    this.map = null;

    this.patchSource = newMap;
    this.patch = new MapPatches.Set(key, undefined, newMap.get(key));
    newMap.map.delete(key);

    return newMap;
};

ImmyMap.prototype.forEach = function (cb) {
    this.__getMap();
    this.map.forEach(cb);
};

ImmyMap.prototype.size = function () {
    this.__getMap();
    return this.map.size;
};

ImmyMap.prototype.has = function (key) {
    this.__getMap();
    return this.map.has(key);
};

module.exports = ImmyMap;

},{"./MapPatches":4}],2:[function(require,module,exports){
var ListPatches = require('./ListPatches');

// a List either owns a buffer and has the data, or has a reference to another
// list and a patch that can be applied to that list to get at this list's data.

function List(initBuffer) {
    if (initBuffer != null) {
        this.buffer = initBuffer.slice();
    } else {
        this.buffer = null;
    }

    this.patchSource = null;
    this.patch = null;

    // lists that share a root share a buffer. {} != {} because objects are
    // compared using reference equality, so this will always be globally unique
    this.root = {};
}


// ensures that the list has a buffer that can be used.
List.prototype.__getBuffer = function () {
  if (this.buffer) {
    return
  }

  if (!this.patchSource) {
    // no patch source and no buffer means that we're an empty list
    this.buffer = []
    return
  }

  // first traverse out along the patch source chain to find a starting point
  // to apply patches from. because we don't store backreferences we need to
  // maintain a stack of targets to apply patches to
  var source = this.patchSource
  var targets = [this]
  while (source.patchSource) {
    targets.push(source)
    source = source.patchSource
  }

  // now work our way back down the stack and apply patches
  while (targets.length > 0) {
    var target = targets.pop()

    target.patch.apply(source.buffer);
    source.patchSource = target;
    source.patch = target.patch.inverse();
    target.buffer = source.buffer;
    source.buffer = null;
    target.patchSource = null;

    source = target
  }
}

List.prototype.push = function (value) {
    if (!this.buffer) this.__getBuffer();

    var newList = new List();
    this.patchSource = newList;
    this.patch = new ListPatches.Remove(this.buffer.length, value);

    newList.buffer = this.buffer;
    this.buffer = null;
    newList.buffer.push(value);
    newList.root = this.root;

    return newList;
};

List.prototype.withValueAdded = function (index, value) {
    if (!this.buffer) this.__getBuffer();

    var newList = new List();
    this.patchSource = newList;
    this.patch = new ListPatches.Remove(index, value);

    newList.buffer = this.buffer;
    this.buffer = null;
    newList.buffer.splice(index, 0, value);
    newList.root = this.root;

    return newList;
};

List.prototype.withValueRemoved = function (index) {
    if (!this.buffer) this.__getBuffer();

    var newList = new List();
    this.patchSource = newList;
    this.patch = new ListPatches.Add(index, this.buffer[index]);

    newList.buffer = this.buffer;
    this.buffer = null;
    newList.buffer.splice(index, 1);
    newList.root = this.root;

    return newList;
};

List.prototype.pop = function () {
    if (!this.buffer) this.__getBuffer();

    var newList = new List();
    this.patchSource = newList;
    this.patch = new ListPatches.Add(this.buffer.length - 1, this.buffer[this.buffer.length - 1]);

    this.buffer.pop();
    newList.buffer = this.buffer;
    this.buffer = null;
    newList.root = this.root;

    return newList;
};

List.prototype.size = function () {
    // TODO: make this fast
    if (!this.buffer) this.__getBuffer();
    return this.buffer.length;
};

List.prototype.get = function (index) {
    if (!this.buffer) this.__getBuffer();
    return this.buffer[index];
};

List.prototype.set = function (index, newValue) {
    if (!this.buffer) this.__getBuffer();

    var newList = new List();
    this.patchSource = newList;
    this.patch = new ListPatches.Sequence([
        new ListPatches.Remove(index, newValue),
        new ListPatches.Add(index, this.buffer[index])
    ]);

    newList.buffer = this.buffer;
    this.buffer = null;
    newList.buffer[index] = newValue;
    newList.root = this.root;

    return newList;
};

List.prototype.forEach = function (fn) {
    if (!this.buffer) this.__getBuffer();
    this.buffer.forEach(fn);
};

List.prototype.findIndex = function (pred) {
    if (!this.buffer) this.__getBuffer();
    return this.buffer.findIndex(pred);
};

// comparisonPred should return 0 if the supplied value is equal to the target,
// -ve if it's less than the target, and +ve if it's greater than the target. note
// that this function doesn't take the target itself as an argument.
List.prototype.findIndexWithBinarySearch = function (comparisonPred) {
    if (!this.buffer) this.__getBuffer();

    var minIndex = 0;
    var maxIndex = this.buffer.length - 1;
    var currentIndex;
    var currentElement;

    while (minIndex <= maxIndex) {
        currentIndex = (minIndex + maxIndex) / 2 | 0;
        currentElement = this.buffer[currentIndex];

        var res = comparisonPred(currentElement);

        if (res < 0) {
            minIndex = currentIndex + 1;
        } else if (res > 0) {
            maxIndex = currentIndex - 1;
        } else {
            // make sure that we return the index of the value that's at the end
            // of the sequence
            while (currentIndex < this.buffer.length - 1 && comparisonPred(this.buffer[currentIndex + 1]) == 0) {
                ++currentIndex;
            }

            return currentIndex;
        }
    }

    return -1;
};

List.prototype.findInsertionIndexWithBinarySearch = function (comparisonPred) {
    if (!this.buffer) this.__getBuffer();

    if (this.buffer.length == 0) {
        return 0;
    }

    var minIndex = 0;
    var maxIndex = this.buffer.length - 1;
    var currentIndex;
    var currentElement;

    while (minIndex <= maxIndex) {
        currentIndex = (minIndex + maxIndex) / 2 | 0;
        currentElement = this.buffer[currentIndex];

        var res = comparisonPred(currentElement);

        if (res < 0) {
            minIndex = currentIndex + 1;
        } else if (res > 0) {
            maxIndex = currentIndex - 1;
        } else {
            // found an identical value, go to the end of the sequence and then
            // return the index that's one after that
            while (currentIndex < this.buffer.length - 1 && comparisonPred(this.buffer[currentIndex + 1]) == 0) {
                ++currentIndex;
            }

            return currentIndex + 1;
        }
    }

    var res = comparisonPred(this.buffer[currentIndex]);
    if (res > 0) {
        // need to insert a value that will be before the current one, so use its
        // index
        return currentIndex;
    } else {
        // we want to insert after this value
        return currentIndex + 1;
    }
};

// doesn't need a __getBuffer call because set and get do that for us
List.prototype.withMutation = function (index, fn) {
    return this.set(index, fn(this.get(index)));
};

List.prototype.slice = function (begin, end) {
    // begin === undefined means begin is assumed to be zero, which means a full
    // copy. immutable lists don't need copying so we don't need to bother with
    // getting our buffer
    if (begin === undefined || (begin === 0 && end === undefined)) {
        return this;
    }

    if (!this.buffer) this.__getBuffer();

    // note, no patch here because we keep our buffer and the slice has its own
    // - the sliced list will have a separate root to us
    var sliced = new List();
    sliced.buffer = this.buffer.slice(begin, end);

    return sliced;
};

List.prototype.splice = function (start, deleteCount) { // [, item1, item2, ...]
    var i;

    if (start === 0 && deleteCount === 0 && arguments.length === 2) {
        return this;
    }

    if (start === undefined) {
        start = 0;
    }

    var deletedItems = this.buffer.splice.apply(this.buffer, arguments);
    var patches = [];

    // remove the newly added items
    for (i = 2; i < arguments.length; ++i) {
        patches.push(new ListPatches.Remove(start, arguments[i]));
    }

    // and re-insert the deleted items
    for (i = 0; i < deletedItems.length; ++i) {
        patches.push(new ListPatches.Add(start + i, deletedItems[i]));
    }

    var newList = new List();
    this.patchSource = newList;
    this.patch = new ListPatches.Sequence(patches);

    newList.buffer = this.buffer;
    this.buffer = null;
    newList.root = this.root;

    return newList;
};

// List.compareTo() a patch which will take this list and make it equal to the
// otherList. i.e, if I have [a, b].compareTo([a, b, c]) then i'll get a patch
// that will add c. swapping the lists will result in a patch that would remove c.
//
// the returned patches won't always be minimal, but they'll be correct.

List.prototype.compareTo = function (otherList, hints) {
    if (otherList.root == this.root) {
        if (otherList == this) {
            return new ListPatches.Sequence([]);
        }

        // guarantee that following the one without a buffer to one with buffer
        // will get us to the other one, as all lists that share the same root
        // are working with patches to the same buffer
        if (this.buffer) {
            // perfect, we can walk from the other list to this and end up with a
            // patch that will go the other way
            return walk(otherList);
        } else if (otherList.buffer) {
            // need to walk from this to the otherList and then return an inverse
            // patch from the walk
            return walk(this).inverse();
        } else {
            // nothing has a buffer, so we need to give one of our lists a buffer
            // to guarantee that we can walk from one and end up at the other. the
            // walk will result in a reversed patch from dst to src, so we give
            // this list a buffer and walk from the other list. that way, we don't
            // have to invert the patch before returning it

            if (!this.buffer) this.__getBuffer();
            return walk(otherList);
        }
    } else {
        // will result in both lists having buffers as we know that they aren't
        // sharing one due to having different roots
        if (!this.buffer) this.__getBuffer();
        otherList.__getBuffer();

        if (hints && hints.ordered) {
            return orderedDiff(this.buffer, otherList.buffer, hints.comparison);
        }

        // we can't walk from one to the other, so we need to use an actual diff
        // algorithm (ideally) to figure out a patch
        return diff(this.buffer, otherList.buffer);
    }
};

function walk(src) {
    var patches = [];
    var curr = src;

    // we should be unshifting, but that's slow. so, we push and do a single
    // reverse at the end.
    while (!curr.buffer) {
        patches.push(curr.patch);
        curr = curr.patchSource;
    }

    patches.reverse();

    if (patches.length == 1) {
        return patches[0];
    } else {
        return new ListPatches.Sequence(patches);
    }
}

// returns a patch that will take the from array and make it become the to array.
// note: FROM AND TO ARE JUST JS ARRAYS, NOT IMMY LISTS.
function diff(fromArr, to) {
    // take the lame way out and return a "patch" that literally just removes
    // everything and then adds the entire contents of the "to" array using a
    // single splice.
    //
    // TODO: rewrite this!

    var i;
    var patches = [];

    // remove everything in "from"
    for (i = fromArr.length - 1; i >= 0; --i) {
        patches.push(new ListPatches.Remove(i, fromArr[i]));
    }

    // add all of "to"
    for (i = 0; i < to.length; ++i) {
        patches.push(new ListPatches.Add(i, to[i]));
    }

    return new ListPatches.Sequence(patches);
}

// O(n) version of diff() that requires the A and B arrays to be ordered
// the comparison function should be like any other list comparison method:
//
//   -ve if a < b
//   0 if a = b
//   +ve if a > b
//
function orderedDiff(A, B, comparison) {
    var patches = [];
    var i, j, k;

    count = 0;
    for (i = 0, j = 0, k = 0; i < A.length && j < B.length; ++k) {
        var res = comparison(A[i], B[j]);

        if (res == null) {
            // replacement, remove and add without changing the insertion index
            patches.push(new ListPatches.Remove(k, A[i]));
            patches.push(new ListPatches.Add(k, B[j]));
            ++i;
            ++j;
        } else if (res == 0) {
            // not changed
            ++i;
            ++j;
        } else if (res < 0) {
            // A[i] < B[j]
            // means that we need to nuke stuff from A until we catch up, keep B
            // at the same place
            patches.push(new ListPatches.Remove(k, A[i]));
            ++i;
            --k;
        } else {
            // A[i] > B[j]
            // means that we added stuff to B that's less than where we are in A,
            // emit Add ops and catch B up
            patches.push(new ListPatches.Add(k, B[j]));
            ++j;
        }
    }

    if (i == A.length && j != B.length) {
        // everything at the end of B is adds
        while (j < B.length) {
            patches.push(new ListPatches.Add(k, B[j]));
            ++j;
            ++k;
        }
    } else if (i != A.length && j == B.length) {
        // everything at the end of A is removes
        while (i < A.length) {
            patches.push(new ListPatches.Remove(k, A[i]));
            ++i;
        }
    }

    return new ListPatches.Sequence(patches);
}

List.prototype.withPatchApplied = function (patch) {
    if (!this.buffer) this.__getBuffer();

    var newList = new List();
    this.patchSource = newList;
    this.patch = patch.inverse();

    newList.buffer = this.buffer;
    this.buffer = null;
    patch.apply(newList.buffer);

    return newList;
};

module.exports = List;

},{"./ListPatches":3}],3:[function(require,module,exports){

/********************************************************************************
 *
 *   ListPatches.Add (implements the ListPatch interface)
 *
 *   Adds the given item at the given index. The index must be in the closed range
 *   [0, array.length], noting that an index of the array's length will append to
 *   the array. This patch is a primitive operation.
 *
 *   Examples:
 *
 *   Add(2, 'foo'):
 *       ['abc', 'def', 'ghi', 'jkl'] -> ['abc', 'def', 'foo', 'ghi', 'jkl']
 *
 *   Add(0, 'bar'):
 *       ['abc', 'def', 'ghi', 'jkl'] -> ['bar', 'abc', 'def', 'foo', 'ghi']
 *
 *   Add(4, 'baz'):
 *       ['abc', 'def', 'ghi', 'jkl'] -> ['abc', 'def', 'ghi', 'jkl', 'baz']
 *
 ********************************************************************************/

function Add(index, value, _inverse) {
    this.index = index;
    this.value = value;
    this._inverse = _inverse
};

Add.prototype.apply = function (array) {
    array.splice(this.index, 0, this.value);
};

Add.prototype.inverse = function () {
    if (!this._inverse) {
        this._inverse = new Remove(this.index, this.value, this)
    }
    
    return this._inverse
};

Add.prototype.toPrimitives = function () {
    return [ this ];
};

Add.prototype.forEachPrimitive = function (cb) {
    cb(this);
};

exports.Add = Add;


/********************************************************************************
 *
 *   ListPatches.Remove (implements the ListPatch interface)
 *
 *   Removes the given item from the given index. The index must be in the closed
 *   range [0, array.length - 1]. This patch is a primitive operation.
 *
 *   It's a reasonable question to ask why this patch needs to store the value
 *   that it's removing. After all, Array.splice doesn't need to know the values
 *   it's removing and works perfectly fine! The reason is that the ListPatch
 *   interface requires patches to have an invert() method, and it's impossible to
 *   consruct the corresponding Add() patch without what knowing what value to
 *   add.
 *
 *   Examples:
 *
 *   Remove(2, 'foo'):
 *       ['abc', 'def', 'foo', 'ghi', 'jkl'] -> ['abc', 'def', 'ghi', 'jkl']
 *
 *   Remove(0, 'bar'):
 *       ['bar', 'abc', 'def', 'foo', 'ghi'] -> ['abc', 'def', 'ghi', 'jkl']
 *
 *   Remove(4, 'baz'):
 *       ['abc', 'def', 'ghi', 'jkl', 'baz'] -> ['abc', 'def', 'ghi', 'jkl']
 *
 ********************************************************************************/

function Remove(index, value, _inverse) {
    this.index = index;
    this.value = value;
    this._inverse = _inverse
};

Remove.prototype.apply = function (array) {
    array.splice(this.index, 1);
};

Remove.prototype.inverse = function () {
    if (!this._inverse) {
        this._inverse = new Add(this.index, this.value, this)
    }

    return this._inverse
};

Remove.prototype.toPrimitives = function () {
    return [ this ];
};

Remove.prototype.forEachPrimitive = function (cb) {
    cb(this);
};

exports.Remove = Remove;


/********************************************************************************
 *
 *   ListPatches.Sequence (implements the ListPatch interface)
 *
 *   Performs a sequence of patches. This patch is not a primitive operation.
 *   Sequence patches allow things like splices to be encapsulated into a single
 *   patch, instead of needing to store individual patches for each add or remove.
 *
 *   The patches are always performed in order.
 *
 *   Examples:
 *
 *   Sequence([Add(2, 'foo'), Add(2, 'bar'), Remove(1, 'def')]):
 *       ['abc', 'def', 'ghi', 'jkl'] -> ['abc', 'bar', 'foo', 'ghi', 'jkl']
 *
 ********************************************************************************/

function Sequence(patches, _inverse) {
    this.patches = patches;
    this._inverse = _inverse
};

Sequence.prototype.apply = function (buffer) {
    var i;

    for (i = 0; i < this.patches.length; ++i) {
        this.patches[i].apply(buffer);
    }
};

Sequence.prototype.inverse = function () {
    if (!this._inverse) {
        var inverted = [];
        var i;

        for (i = this.patches.length - 1; i >= 0; --i) {
            inverted.push(this.patches[i].inverse());
        }

        this._inverse = new Sequence(inverted, this);
    }

    return this._inverse
};

Sequence.prototype.toPrimitives = function () {
    var primitives = [];
    var i;

    for (i = 0; i < this.patches.length; ++i) {
        Array.prototype.push.apply(primitives, this.patches[i].toPrimitives());
    }

    return primitives;
};

Sequence.prototype.forEachPrimitive = function (cb) {
    var i;

    for (i = 0; i < this.patches.length; ++i) {
        this.patches[i].forEachPrimitive(cb);
    }
};

exports.Sequence = Sequence;

},{}],4:[function(require,module,exports){

/********************************************************************************
 *
 *   MapPatches.Set (implements the MapPatch interface)
 *   (implemented as SetPatch to avoid name collisions, and exported as Set)
 *
 *   Sets the given key from the old value to the new value. This is a primitive
 *   operation. Use a value of undefined to delete the value.
 *
 *   Examples:
 *
 *   Set('foo', undefined, 'bar'):
 *       { a: 'b', 1: 2 } -> { a: 'b', 1:2, 'foo', 'bar' }
 *
 *   Set('a', 'b', 'c'):
 *       { a: 'b', 1: 2 } -> { a: 'c', 1:2 }
 *
 *   Set(1, 2, undefined):
 *       { a: 'b', 1: 2 } -> { a: 'c' }
 *
 ********************************************************************************/

function SetPatch(key, oldValue, newValue) {
    this.key = key;
    this.oldValue = oldValue;
    this.newValue = newValue;
};

SetPatch.prototype.apply = function (map) {
    if (this.newValue === undefined) {
        map.delete(this.key);
    } else {
        map.set(this.key, this.newValue);
    }
};

SetPatch.prototype.inverse = function () {
    return new SetPatch(this.key, this.newValue, this.oldValue);
};

SetPatch.prototype.toPrimitives = function () {
    return [ this ];
};

SetPatch.prototype.forEachPrimitive = function (cb) {
    cb(this);
};

exports.Set = SetPatch;

/********************************************************************************
 *
 *   MapPatches.Sequence (implements the MapPatch interface)
 *
 *   Performs a sequence of patches. This patch is not a primitive operation.
 *   Sequence patches allow multiple operations to be encapsulated into a single
 *   patch.
 *
 *   The patches are always performed in order. (Which means it's possible for
 *   patches within the sequence to cancel themselves out)
 *
 *   Examples:
 *
 *   Sequence([Set('a', Set.NOTHING, 'b'), Set('foo', 'bar', 'baz')]):
 *       { foo: 'bar' } -> { foo: 'baz', a: 'b' }
 *
 ********************************************************************************/

function Sequence(patches) {
    this.patches = patches;
};

Sequence.prototype.apply = function (map) {
    var i;

    for (i = 0; i < this.patches.length; ++i) {
        this.patches[i].apply(map);
    }
};

Sequence.prototype.inverse = function () {
    var inverted = [];
    var i;

    for (i = this.patches.length - 1; i >= 0; --i) {
        inverted.push(this.patches[i].inverse());
    }

    return new Sequence(inverted);
};

Sequence.prototype.toPrimitives = function () {
    var primitives = [];
    var i;

    for (i = 0; i < this.patches.length; ++i) {
        Array.prototype.push.apply(primitives, this.patches[i].toPrimitives());
    }

    return primitives;
};

Sequence.prototype.forEachPrimitive = function (cb) {
    var i;

    for (i = 0; i < this.patches.length; ++i) {
        this.patches[i].forEachPrimitive(cb);
    }
};

exports.Sequence = Sequence;

},{}],5:[function(require,module,exports){

module.exports = {
    List: require('./List'),
    ListPatches: require('./ListPatches'),
    Map: require('./ImmyMap'),
    MapPatches: require('./MapPatches')
};

},{"./ImmyMap":1,"./List":2,"./ListPatches":3,"./MapPatches":4}],6:[function(require,module,exports){
var getNative = require('./_getNative'),
    root = require('./_root');

/* Built-in method references that are verified to be native. */
var DataView = getNative(root, 'DataView');

module.exports = DataView;

},{"./_getNative":54,"./_root":89}],7:[function(require,module,exports){
var hashClear = require('./_hashClear'),
    hashDelete = require('./_hashDelete'),
    hashGet = require('./_hashGet'),
    hashHas = require('./_hashHas'),
    hashSet = require('./_hashSet');

/**
 * Creates a hash object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Hash(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

// Add methods to `Hash`.
Hash.prototype.clear = hashClear;
Hash.prototype['delete'] = hashDelete;
Hash.prototype.get = hashGet;
Hash.prototype.has = hashHas;
Hash.prototype.set = hashSet;

module.exports = Hash;

},{"./_hashClear":60,"./_hashDelete":61,"./_hashGet":62,"./_hashHas":63,"./_hashSet":64}],8:[function(require,module,exports){
var listCacheClear = require('./_listCacheClear'),
    listCacheDelete = require('./_listCacheDelete'),
    listCacheGet = require('./_listCacheGet'),
    listCacheHas = require('./_listCacheHas'),
    listCacheSet = require('./_listCacheSet');

/**
 * Creates an list cache object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function ListCache(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

// Add methods to `ListCache`.
ListCache.prototype.clear = listCacheClear;
ListCache.prototype['delete'] = listCacheDelete;
ListCache.prototype.get = listCacheGet;
ListCache.prototype.has = listCacheHas;
ListCache.prototype.set = listCacheSet;

module.exports = ListCache;

},{"./_listCacheClear":71,"./_listCacheDelete":72,"./_listCacheGet":73,"./_listCacheHas":74,"./_listCacheSet":75}],9:[function(require,module,exports){
var getNative = require('./_getNative'),
    root = require('./_root');

/* Built-in method references that are verified to be native. */
var Map = getNative(root, 'Map');

module.exports = Map;

},{"./_getNative":54,"./_root":89}],10:[function(require,module,exports){
var mapCacheClear = require('./_mapCacheClear'),
    mapCacheDelete = require('./_mapCacheDelete'),
    mapCacheGet = require('./_mapCacheGet'),
    mapCacheHas = require('./_mapCacheHas'),
    mapCacheSet = require('./_mapCacheSet');

/**
 * Creates a map cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function MapCache(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

// Add methods to `MapCache`.
MapCache.prototype.clear = mapCacheClear;
MapCache.prototype['delete'] = mapCacheDelete;
MapCache.prototype.get = mapCacheGet;
MapCache.prototype.has = mapCacheHas;
MapCache.prototype.set = mapCacheSet;

module.exports = MapCache;

},{"./_mapCacheClear":76,"./_mapCacheDelete":77,"./_mapCacheGet":78,"./_mapCacheHas":79,"./_mapCacheSet":80}],11:[function(require,module,exports){
var getNative = require('./_getNative'),
    root = require('./_root');

/* Built-in method references that are verified to be native. */
var Promise = getNative(root, 'Promise');

module.exports = Promise;

},{"./_getNative":54,"./_root":89}],12:[function(require,module,exports){
var getNative = require('./_getNative'),
    root = require('./_root');

/* Built-in method references that are verified to be native. */
var Set = getNative(root, 'Set');

module.exports = Set;

},{"./_getNative":54,"./_root":89}],13:[function(require,module,exports){
var MapCache = require('./_MapCache'),
    setCacheAdd = require('./_setCacheAdd'),
    setCacheHas = require('./_setCacheHas');

/**
 *
 * Creates an array cache object to store unique values.
 *
 * @private
 * @constructor
 * @param {Array} [values] The values to cache.
 */
function SetCache(values) {
  var index = -1,
      length = values == null ? 0 : values.length;

  this.__data__ = new MapCache;
  while (++index < length) {
    this.add(values[index]);
  }
}

// Add methods to `SetCache`.
SetCache.prototype.add = SetCache.prototype.push = setCacheAdd;
SetCache.prototype.has = setCacheHas;

module.exports = SetCache;

},{"./_MapCache":10,"./_setCacheAdd":90,"./_setCacheHas":91}],14:[function(require,module,exports){
var ListCache = require('./_ListCache'),
    stackClear = require('./_stackClear'),
    stackDelete = require('./_stackDelete'),
    stackGet = require('./_stackGet'),
    stackHas = require('./_stackHas'),
    stackSet = require('./_stackSet');

/**
 * Creates a stack cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Stack(entries) {
  var data = this.__data__ = new ListCache(entries);
  this.size = data.size;
}

// Add methods to `Stack`.
Stack.prototype.clear = stackClear;
Stack.prototype['delete'] = stackDelete;
Stack.prototype.get = stackGet;
Stack.prototype.has = stackHas;
Stack.prototype.set = stackSet;

module.exports = Stack;

},{"./_ListCache":8,"./_stackClear":93,"./_stackDelete":94,"./_stackGet":95,"./_stackHas":96,"./_stackSet":97}],15:[function(require,module,exports){
var root = require('./_root');

/** Built-in value references. */
var Symbol = root.Symbol;

module.exports = Symbol;

},{"./_root":89}],16:[function(require,module,exports){
var root = require('./_root');

/** Built-in value references. */
var Uint8Array = root.Uint8Array;

module.exports = Uint8Array;

},{"./_root":89}],17:[function(require,module,exports){
var getNative = require('./_getNative'),
    root = require('./_root');

/* Built-in method references that are verified to be native. */
var WeakMap = getNative(root, 'WeakMap');

module.exports = WeakMap;

},{"./_getNative":54,"./_root":89}],18:[function(require,module,exports){
/**
 * A specialized version of `_.filter` for arrays without support for
 * iteratee shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {Array} Returns the new filtered array.
 */
function arrayFilter(array, predicate) {
  var index = -1,
      length = array == null ? 0 : array.length,
      resIndex = 0,
      result = [];

  while (++index < length) {
    var value = array[index];
    if (predicate(value, index, array)) {
      result[resIndex++] = value;
    }
  }
  return result;
}

module.exports = arrayFilter;

},{}],19:[function(require,module,exports){
var baseTimes = require('./_baseTimes'),
    isArguments = require('./isArguments'),
    isArray = require('./isArray'),
    isBuffer = require('./isBuffer'),
    isIndex = require('./_isIndex'),
    isTypedArray = require('./isTypedArray');

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Creates an array of the enumerable property names of the array-like `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @param {boolean} inherited Specify returning inherited property names.
 * @returns {Array} Returns the array of property names.
 */
function arrayLikeKeys(value, inherited) {
  var isArr = isArray(value),
      isArg = !isArr && isArguments(value),
      isBuff = !isArr && !isArg && isBuffer(value),
      isType = !isArr && !isArg && !isBuff && isTypedArray(value),
      skipIndexes = isArr || isArg || isBuff || isType,
      result = skipIndexes ? baseTimes(value.length, String) : [],
      length = result.length;

  for (var key in value) {
    if ((inherited || hasOwnProperty.call(value, key)) &&
        !(skipIndexes && (
           // Safari 9 has enumerable `arguments.length` in strict mode.
           key == 'length' ||
           // Node.js 0.10 has enumerable non-index properties on buffers.
           (isBuff && (key == 'offset' || key == 'parent')) ||
           // PhantomJS 2 has enumerable non-index properties on typed arrays.
           (isType && (key == 'buffer' || key == 'byteLength' || key == 'byteOffset')) ||
           // Skip index properties.
           isIndex(key, length)
        ))) {
      result.push(key);
    }
  }
  return result;
}

module.exports = arrayLikeKeys;

},{"./_baseTimes":41,"./_isIndex":65,"./isArguments":105,"./isArray":106,"./isBuffer":108,"./isTypedArray":114}],20:[function(require,module,exports){
/**
 * A specialized version of `_.map` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the new mapped array.
 */
function arrayMap(array, iteratee) {
  var index = -1,
      length = array == null ? 0 : array.length,
      result = Array(length);

  while (++index < length) {
    result[index] = iteratee(array[index], index, array);
  }
  return result;
}

module.exports = arrayMap;

},{}],21:[function(require,module,exports){
/**
 * Appends the elements of `values` to `array`.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {Array} values The values to append.
 * @returns {Array} Returns `array`.
 */
function arrayPush(array, values) {
  var index = -1,
      length = values.length,
      offset = array.length;

  while (++index < length) {
    array[offset + index] = values[index];
  }
  return array;
}

module.exports = arrayPush;

},{}],22:[function(require,module,exports){
/**
 * A specialized version of `_.some` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {boolean} Returns `true` if any element passes the predicate check,
 *  else `false`.
 */
function arraySome(array, predicate) {
  var index = -1,
      length = array == null ? 0 : array.length;

  while (++index < length) {
    if (predicate(array[index], index, array)) {
      return true;
    }
  }
  return false;
}

module.exports = arraySome;

},{}],23:[function(require,module,exports){
var eq = require('./eq');

/**
 * Gets the index at which the `key` is found in `array` of key-value pairs.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {*} key The key to search for.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function assocIndexOf(array, key) {
  var length = array.length;
  while (length--) {
    if (eq(array[length][0], key)) {
      return length;
    }
  }
  return -1;
}

module.exports = assocIndexOf;

},{"./eq":101}],24:[function(require,module,exports){
var castPath = require('./_castPath'),
    toKey = require('./_toKey');

/**
 * The base implementation of `_.get` without support for default values.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} path The path of the property to get.
 * @returns {*} Returns the resolved value.
 */
function baseGet(object, path) {
  path = castPath(path, object);

  var index = 0,
      length = path.length;

  while (object != null && index < length) {
    object = object[toKey(path[index++])];
  }
  return (index && index == length) ? object : undefined;
}

module.exports = baseGet;

},{"./_castPath":45,"./_toKey":99}],25:[function(require,module,exports){
var arrayPush = require('./_arrayPush'),
    isArray = require('./isArray');

/**
 * The base implementation of `getAllKeys` and `getAllKeysIn` which uses
 * `keysFunc` and `symbolsFunc` to get the enumerable property names and
 * symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Function} keysFunc The function to get the keys of `object`.
 * @param {Function} symbolsFunc The function to get the symbols of `object`.
 * @returns {Array} Returns the array of property names and symbols.
 */
function baseGetAllKeys(object, keysFunc, symbolsFunc) {
  var result = keysFunc(object);
  return isArray(object) ? result : arrayPush(result, symbolsFunc(object));
}

module.exports = baseGetAllKeys;

},{"./_arrayPush":21,"./isArray":106}],26:[function(require,module,exports){
var Symbol = require('./_Symbol'),
    getRawTag = require('./_getRawTag'),
    objectToString = require('./_objectToString');

/** `Object#toString` result references. */
var nullTag = '[object Null]',
    undefinedTag = '[object Undefined]';

/** Built-in value references. */
var symToStringTag = Symbol ? Symbol.toStringTag : undefined;

/**
 * The base implementation of `getTag` without fallbacks for buggy environments.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
function baseGetTag(value) {
  if (value == null) {
    return value === undefined ? undefinedTag : nullTag;
  }
  return (symToStringTag && symToStringTag in Object(value))
    ? getRawTag(value)
    : objectToString(value);
}

module.exports = baseGetTag;

},{"./_Symbol":15,"./_getRawTag":55,"./_objectToString":87}],27:[function(require,module,exports){
/**
 * The base implementation of `_.hasIn` without support for deep paths.
 *
 * @private
 * @param {Object} [object] The object to query.
 * @param {Array|string} key The key to check.
 * @returns {boolean} Returns `true` if `key` exists, else `false`.
 */
function baseHasIn(object, key) {
  return object != null && key in Object(object);
}

module.exports = baseHasIn;

},{}],28:[function(require,module,exports){
var baseGetTag = require('./_baseGetTag'),
    isObjectLike = require('./isObjectLike');

/** `Object#toString` result references. */
var argsTag = '[object Arguments]';

/**
 * The base implementation of `_.isArguments`.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 */
function baseIsArguments(value) {
  return isObjectLike(value) && baseGetTag(value) == argsTag;
}

module.exports = baseIsArguments;

},{"./_baseGetTag":26,"./isObjectLike":112}],29:[function(require,module,exports){
var baseIsEqualDeep = require('./_baseIsEqualDeep'),
    isObjectLike = require('./isObjectLike');

/**
 * The base implementation of `_.isEqual` which supports partial comparisons
 * and tracks traversed objects.
 *
 * @private
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @param {boolean} bitmask The bitmask flags.
 *  1 - Unordered comparison
 *  2 - Partial comparison
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {Object} [stack] Tracks traversed `value` and `other` objects.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 */
function baseIsEqual(value, other, bitmask, customizer, stack) {
  if (value === other) {
    return true;
  }
  if (value == null || other == null || (!isObjectLike(value) && !isObjectLike(other))) {
    return value !== value && other !== other;
  }
  return baseIsEqualDeep(value, other, bitmask, customizer, baseIsEqual, stack);
}

module.exports = baseIsEqual;

},{"./_baseIsEqualDeep":30,"./isObjectLike":112}],30:[function(require,module,exports){
var Stack = require('./_Stack'),
    equalArrays = require('./_equalArrays'),
    equalByTag = require('./_equalByTag'),
    equalObjects = require('./_equalObjects'),
    getTag = require('./_getTag'),
    isArray = require('./isArray'),
    isBuffer = require('./isBuffer'),
    isTypedArray = require('./isTypedArray');

/** Used to compose bitmasks for value comparisons. */
var COMPARE_PARTIAL_FLAG = 1;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    objectTag = '[object Object]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * A specialized version of `baseIsEqual` for arrays and objects which performs
 * deep comparisons and tracks traversed objects enabling objects with circular
 * references to be compared.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} [stack] Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function baseIsEqualDeep(object, other, bitmask, customizer, equalFunc, stack) {
  var objIsArr = isArray(object),
      othIsArr = isArray(other),
      objTag = objIsArr ? arrayTag : getTag(object),
      othTag = othIsArr ? arrayTag : getTag(other);

  objTag = objTag == argsTag ? objectTag : objTag;
  othTag = othTag == argsTag ? objectTag : othTag;

  var objIsObj = objTag == objectTag,
      othIsObj = othTag == objectTag,
      isSameTag = objTag == othTag;

  if (isSameTag && isBuffer(object)) {
    if (!isBuffer(other)) {
      return false;
    }
    objIsArr = true;
    objIsObj = false;
  }
  if (isSameTag && !objIsObj) {
    stack || (stack = new Stack);
    return (objIsArr || isTypedArray(object))
      ? equalArrays(object, other, bitmask, customizer, equalFunc, stack)
      : equalByTag(object, other, objTag, bitmask, customizer, equalFunc, stack);
  }
  if (!(bitmask & COMPARE_PARTIAL_FLAG)) {
    var objIsWrapped = objIsObj && hasOwnProperty.call(object, '__wrapped__'),
        othIsWrapped = othIsObj && hasOwnProperty.call(other, '__wrapped__');

    if (objIsWrapped || othIsWrapped) {
      var objUnwrapped = objIsWrapped ? object.value() : object,
          othUnwrapped = othIsWrapped ? other.value() : other;

      stack || (stack = new Stack);
      return equalFunc(objUnwrapped, othUnwrapped, bitmask, customizer, stack);
    }
  }
  if (!isSameTag) {
    return false;
  }
  stack || (stack = new Stack);
  return equalObjects(object, other, bitmask, customizer, equalFunc, stack);
}

module.exports = baseIsEqualDeep;

},{"./_Stack":14,"./_equalArrays":47,"./_equalByTag":48,"./_equalObjects":49,"./_getTag":57,"./isArray":106,"./isBuffer":108,"./isTypedArray":114}],31:[function(require,module,exports){
var Stack = require('./_Stack'),
    baseIsEqual = require('./_baseIsEqual');

/** Used to compose bitmasks for value comparisons. */
var COMPARE_PARTIAL_FLAG = 1,
    COMPARE_UNORDERED_FLAG = 2;

/**
 * The base implementation of `_.isMatch` without support for iteratee shorthands.
 *
 * @private
 * @param {Object} object The object to inspect.
 * @param {Object} source The object of property values to match.
 * @param {Array} matchData The property names, values, and compare flags to match.
 * @param {Function} [customizer] The function to customize comparisons.
 * @returns {boolean} Returns `true` if `object` is a match, else `false`.
 */
function baseIsMatch(object, source, matchData, customizer) {
  var index = matchData.length,
      length = index,
      noCustomizer = !customizer;

  if (object == null) {
    return !length;
  }
  object = Object(object);
  while (index--) {
    var data = matchData[index];
    if ((noCustomizer && data[2])
          ? data[1] !== object[data[0]]
          : !(data[0] in object)
        ) {
      return false;
    }
  }
  while (++index < length) {
    data = matchData[index];
    var key = data[0],
        objValue = object[key],
        srcValue = data[1];

    if (noCustomizer && data[2]) {
      if (objValue === undefined && !(key in object)) {
        return false;
      }
    } else {
      var stack = new Stack;
      if (customizer) {
        var result = customizer(objValue, srcValue, key, object, source, stack);
      }
      if (!(result === undefined
            ? baseIsEqual(srcValue, objValue, COMPARE_PARTIAL_FLAG | COMPARE_UNORDERED_FLAG, customizer, stack)
            : result
          )) {
        return false;
      }
    }
  }
  return true;
}

module.exports = baseIsMatch;

},{"./_Stack":14,"./_baseIsEqual":29}],32:[function(require,module,exports){
var isFunction = require('./isFunction'),
    isMasked = require('./_isMasked'),
    isObject = require('./isObject'),
    toSource = require('./_toSource');

/**
 * Used to match `RegExp`
 * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
 */
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

/** Used to detect host constructors (Safari). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/** Used for built-in method references. */
var funcProto = Function.prototype,
    objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/**
 * The base implementation of `_.isNative` without bad shim checks.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function,
 *  else `false`.
 */
function baseIsNative(value) {
  if (!isObject(value) || isMasked(value)) {
    return false;
  }
  var pattern = isFunction(value) ? reIsNative : reIsHostCtor;
  return pattern.test(toSource(value));
}

module.exports = baseIsNative;

},{"./_isMasked":68,"./_toSource":100,"./isFunction":109,"./isObject":111}],33:[function(require,module,exports){
var baseGetTag = require('./_baseGetTag'),
    isLength = require('./isLength'),
    isObjectLike = require('./isObjectLike');

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    funcTag = '[object Function]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    objectTag = '[object Object]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    weakMapTag = '[object WeakMap]';

var arrayBufferTag = '[object ArrayBuffer]',
    dataViewTag = '[object DataView]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

/** Used to identify `toStringTag` values of typed arrays. */
var typedArrayTags = {};
typedArrayTags[float32Tag] = typedArrayTags[float64Tag] =
typedArrayTags[int8Tag] = typedArrayTags[int16Tag] =
typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] =
typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] =
typedArrayTags[uint32Tag] = true;
typedArrayTags[argsTag] = typedArrayTags[arrayTag] =
typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] =
typedArrayTags[dataViewTag] = typedArrayTags[dateTag] =
typedArrayTags[errorTag] = typedArrayTags[funcTag] =
typedArrayTags[mapTag] = typedArrayTags[numberTag] =
typedArrayTags[objectTag] = typedArrayTags[regexpTag] =
typedArrayTags[setTag] = typedArrayTags[stringTag] =
typedArrayTags[weakMapTag] = false;

/**
 * The base implementation of `_.isTypedArray` without Node.js optimizations.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 */
function baseIsTypedArray(value) {
  return isObjectLike(value) &&
    isLength(value.length) && !!typedArrayTags[baseGetTag(value)];
}

module.exports = baseIsTypedArray;

},{"./_baseGetTag":26,"./isLength":110,"./isObjectLike":112}],34:[function(require,module,exports){
var baseMatches = require('./_baseMatches'),
    baseMatchesProperty = require('./_baseMatchesProperty'),
    identity = require('./identity'),
    isArray = require('./isArray'),
    property = require('./property');

/**
 * The base implementation of `_.iteratee`.
 *
 * @private
 * @param {*} [value=_.identity] The value to convert to an iteratee.
 * @returns {Function} Returns the iteratee.
 */
function baseIteratee(value) {
  // Don't store the `typeof` result in a variable to avoid a JIT bug in Safari 9.
  // See https://bugs.webkit.org/show_bug.cgi?id=156034 for more details.
  if (typeof value == 'function') {
    return value;
  }
  if (value == null) {
    return identity;
  }
  if (typeof value == 'object') {
    return isArray(value)
      ? baseMatchesProperty(value[0], value[1])
      : baseMatches(value);
  }
  return property(value);
}

module.exports = baseIteratee;

},{"./_baseMatches":36,"./_baseMatchesProperty":37,"./identity":104,"./isArray":106,"./property":117}],35:[function(require,module,exports){
var isPrototype = require('./_isPrototype'),
    nativeKeys = require('./_nativeKeys');

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeys(object) {
  if (!isPrototype(object)) {
    return nativeKeys(object);
  }
  var result = [];
  for (var key in Object(object)) {
    if (hasOwnProperty.call(object, key) && key != 'constructor') {
      result.push(key);
    }
  }
  return result;
}

module.exports = baseKeys;

},{"./_isPrototype":69,"./_nativeKeys":85}],36:[function(require,module,exports){
var baseIsMatch = require('./_baseIsMatch'),
    getMatchData = require('./_getMatchData'),
    matchesStrictComparable = require('./_matchesStrictComparable');

/**
 * The base implementation of `_.matches` which doesn't clone `source`.
 *
 * @private
 * @param {Object} source The object of property values to match.
 * @returns {Function} Returns the new spec function.
 */
function baseMatches(source) {
  var matchData = getMatchData(source);
  if (matchData.length == 1 && matchData[0][2]) {
    return matchesStrictComparable(matchData[0][0], matchData[0][1]);
  }
  return function(object) {
    return object === source || baseIsMatch(object, source, matchData);
  };
}

module.exports = baseMatches;

},{"./_baseIsMatch":31,"./_getMatchData":53,"./_matchesStrictComparable":82}],37:[function(require,module,exports){
var baseIsEqual = require('./_baseIsEqual'),
    get = require('./get'),
    hasIn = require('./hasIn'),
    isKey = require('./_isKey'),
    isStrictComparable = require('./_isStrictComparable'),
    matchesStrictComparable = require('./_matchesStrictComparable'),
    toKey = require('./_toKey');

/** Used to compose bitmasks for value comparisons. */
var COMPARE_PARTIAL_FLAG = 1,
    COMPARE_UNORDERED_FLAG = 2;

/**
 * The base implementation of `_.matchesProperty` which doesn't clone `srcValue`.
 *
 * @private
 * @param {string} path The path of the property to get.
 * @param {*} srcValue The value to match.
 * @returns {Function} Returns the new spec function.
 */
function baseMatchesProperty(path, srcValue) {
  if (isKey(path) && isStrictComparable(srcValue)) {
    return matchesStrictComparable(toKey(path), srcValue);
  }
  return function(object) {
    var objValue = get(object, path);
    return (objValue === undefined && objValue === srcValue)
      ? hasIn(object, path)
      : baseIsEqual(srcValue, objValue, COMPARE_PARTIAL_FLAG | COMPARE_UNORDERED_FLAG);
  };
}

module.exports = baseMatchesProperty;

},{"./_baseIsEqual":29,"./_isKey":66,"./_isStrictComparable":70,"./_matchesStrictComparable":82,"./_toKey":99,"./get":102,"./hasIn":103}],38:[function(require,module,exports){
/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new accessor function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

module.exports = baseProperty;

},{}],39:[function(require,module,exports){
var baseGet = require('./_baseGet');

/**
 * A specialized version of `baseProperty` which supports deep paths.
 *
 * @private
 * @param {Array|string} path The path of the property to get.
 * @returns {Function} Returns the new accessor function.
 */
function basePropertyDeep(path) {
  return function(object) {
    return baseGet(object, path);
  };
}

module.exports = basePropertyDeep;

},{"./_baseGet":24}],40:[function(require,module,exports){
var isSymbol = require('./isSymbol');

/** Used as references for the maximum length and index of an array. */
var MAX_ARRAY_LENGTH = 4294967295,
    MAX_ARRAY_INDEX = MAX_ARRAY_LENGTH - 1;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeFloor = Math.floor,
    nativeMin = Math.min;

/**
 * The base implementation of `_.sortedIndexBy` and `_.sortedLastIndexBy`
 * which invokes `iteratee` for `value` and each element of `array` to compute
 * their sort ranking. The iteratee is invoked with one argument; (value).
 *
 * @private
 * @param {Array} array The sorted array to inspect.
 * @param {*} value The value to evaluate.
 * @param {Function} iteratee The iteratee invoked per element.
 * @param {boolean} [retHighest] Specify returning the highest qualified index.
 * @returns {number} Returns the index at which `value` should be inserted
 *  into `array`.
 */
function baseSortedIndexBy(array, value, iteratee, retHighest) {
  var low = 0,
      high = array == null ? 0 : array.length;
  if (high === 0) {
    return 0;
  }

  value = iteratee(value);
  var valIsNaN = value !== value,
      valIsNull = value === null,
      valIsSymbol = isSymbol(value),
      valIsUndefined = value === undefined;

  while (low < high) {
    var mid = nativeFloor((low + high) / 2),
        computed = iteratee(array[mid]),
        othIsDefined = computed !== undefined,
        othIsNull = computed === null,
        othIsReflexive = computed === computed,
        othIsSymbol = isSymbol(computed);

    if (valIsNaN) {
      var setLow = retHighest || othIsReflexive;
    } else if (valIsUndefined) {
      setLow = othIsReflexive && (retHighest || othIsDefined);
    } else if (valIsNull) {
      setLow = othIsReflexive && othIsDefined && (retHighest || !othIsNull);
    } else if (valIsSymbol) {
      setLow = othIsReflexive && othIsDefined && !othIsNull && (retHighest || !othIsSymbol);
    } else if (othIsNull || othIsSymbol) {
      setLow = false;
    } else {
      setLow = retHighest ? (computed <= value) : (computed < value);
    }
    if (setLow) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return nativeMin(high, MAX_ARRAY_INDEX);
}

module.exports = baseSortedIndexBy;

},{"./isSymbol":113}],41:[function(require,module,exports){
/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

module.exports = baseTimes;

},{}],42:[function(require,module,exports){
var Symbol = require('./_Symbol'),
    arrayMap = require('./_arrayMap'),
    isArray = require('./isArray'),
    isSymbol = require('./isSymbol');

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0;

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolToString = symbolProto ? symbolProto.toString : undefined;

/**
 * The base implementation of `_.toString` which doesn't convert nullish
 * values to empty strings.
 *
 * @private
 * @param {*} value The value to process.
 * @returns {string} Returns the string.
 */
function baseToString(value) {
  // Exit early for strings to avoid a performance hit in some environments.
  if (typeof value == 'string') {
    return value;
  }
  if (isArray(value)) {
    // Recursively convert values (susceptible to call stack limits).
    return arrayMap(value, baseToString) + '';
  }
  if (isSymbol(value)) {
    return symbolToString ? symbolToString.call(value) : '';
  }
  var result = (value + '');
  return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
}

module.exports = baseToString;

},{"./_Symbol":15,"./_arrayMap":20,"./isArray":106,"./isSymbol":113}],43:[function(require,module,exports){
/**
 * The base implementation of `_.unary` without support for storing metadata.
 *
 * @private
 * @param {Function} func The function to cap arguments for.
 * @returns {Function} Returns the new capped function.
 */
function baseUnary(func) {
  return function(value) {
    return func(value);
  };
}

module.exports = baseUnary;

},{}],44:[function(require,module,exports){
/**
 * Checks if a `cache` value for `key` exists.
 *
 * @private
 * @param {Object} cache The cache to query.
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function cacheHas(cache, key) {
  return cache.has(key);
}

module.exports = cacheHas;

},{}],45:[function(require,module,exports){
var isArray = require('./isArray'),
    isKey = require('./_isKey'),
    stringToPath = require('./_stringToPath'),
    toString = require('./toString');

/**
 * Casts `value` to a path array if it's not one.
 *
 * @private
 * @param {*} value The value to inspect.
 * @param {Object} [object] The object to query keys on.
 * @returns {Array} Returns the cast property path array.
 */
function castPath(value, object) {
  if (isArray(value)) {
    return value;
  }
  return isKey(value, object) ? [value] : stringToPath(toString(value));
}

module.exports = castPath;

},{"./_isKey":66,"./_stringToPath":98,"./isArray":106,"./toString":121}],46:[function(require,module,exports){
var root = require('./_root');

/** Used to detect overreaching core-js shims. */
var coreJsData = root['__core-js_shared__'];

module.exports = coreJsData;

},{"./_root":89}],47:[function(require,module,exports){
var SetCache = require('./_SetCache'),
    arraySome = require('./_arraySome'),
    cacheHas = require('./_cacheHas');

/** Used to compose bitmasks for value comparisons. */
var COMPARE_PARTIAL_FLAG = 1,
    COMPARE_UNORDERED_FLAG = 2;

/**
 * A specialized version of `baseIsEqualDeep` for arrays with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Array} array The array to compare.
 * @param {Array} other The other array to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} stack Tracks traversed `array` and `other` objects.
 * @returns {boolean} Returns `true` if the arrays are equivalent, else `false`.
 */
function equalArrays(array, other, bitmask, customizer, equalFunc, stack) {
  var isPartial = bitmask & COMPARE_PARTIAL_FLAG,
      arrLength = array.length,
      othLength = other.length;

  if (arrLength != othLength && !(isPartial && othLength > arrLength)) {
    return false;
  }
  // Check that cyclic values are equal.
  var arrStacked = stack.get(array);
  var othStacked = stack.get(other);
  if (arrStacked && othStacked) {
    return arrStacked == other && othStacked == array;
  }
  var index = -1,
      result = true,
      seen = (bitmask & COMPARE_UNORDERED_FLAG) ? new SetCache : undefined;

  stack.set(array, other);
  stack.set(other, array);

  // Ignore non-index properties.
  while (++index < arrLength) {
    var arrValue = array[index],
        othValue = other[index];

    if (customizer) {
      var compared = isPartial
        ? customizer(othValue, arrValue, index, other, array, stack)
        : customizer(arrValue, othValue, index, array, other, stack);
    }
    if (compared !== undefined) {
      if (compared) {
        continue;
      }
      result = false;
      break;
    }
    // Recursively compare arrays (susceptible to call stack limits).
    if (seen) {
      if (!arraySome(other, function(othValue, othIndex) {
            if (!cacheHas(seen, othIndex) &&
                (arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) {
              return seen.push(othIndex);
            }
          })) {
        result = false;
        break;
      }
    } else if (!(
          arrValue === othValue ||
            equalFunc(arrValue, othValue, bitmask, customizer, stack)
        )) {
      result = false;
      break;
    }
  }
  stack['delete'](array);
  stack['delete'](other);
  return result;
}

module.exports = equalArrays;

},{"./_SetCache":13,"./_arraySome":22,"./_cacheHas":44}],48:[function(require,module,exports){
var Symbol = require('./_Symbol'),
    Uint8Array = require('./_Uint8Array'),
    eq = require('./eq'),
    equalArrays = require('./_equalArrays'),
    mapToArray = require('./_mapToArray'),
    setToArray = require('./_setToArray');

/** Used to compose bitmasks for value comparisons. */
var COMPARE_PARTIAL_FLAG = 1,
    COMPARE_UNORDERED_FLAG = 2;

/** `Object#toString` result references. */
var boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    symbolTag = '[object Symbol]';

var arrayBufferTag = '[object ArrayBuffer]',
    dataViewTag = '[object DataView]';

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolValueOf = symbolProto ? symbolProto.valueOf : undefined;

/**
 * A specialized version of `baseIsEqualDeep` for comparing objects of
 * the same `toStringTag`.
 *
 * **Note:** This function only supports comparing values with tags of
 * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {string} tag The `toStringTag` of the objects to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} stack Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalByTag(object, other, tag, bitmask, customizer, equalFunc, stack) {
  switch (tag) {
    case dataViewTag:
      if ((object.byteLength != other.byteLength) ||
          (object.byteOffset != other.byteOffset)) {
        return false;
      }
      object = object.buffer;
      other = other.buffer;

    case arrayBufferTag:
      if ((object.byteLength != other.byteLength) ||
          !equalFunc(new Uint8Array(object), new Uint8Array(other))) {
        return false;
      }
      return true;

    case boolTag:
    case dateTag:
    case numberTag:
      // Coerce booleans to `1` or `0` and dates to milliseconds.
      // Invalid dates are coerced to `NaN`.
      return eq(+object, +other);

    case errorTag:
      return object.name == other.name && object.message == other.message;

    case regexpTag:
    case stringTag:
      // Coerce regexes to strings and treat strings, primitives and objects,
      // as equal. See http://www.ecma-international.org/ecma-262/7.0/#sec-regexp.prototype.tostring
      // for more details.
      return object == (other + '');

    case mapTag:
      var convert = mapToArray;

    case setTag:
      var isPartial = bitmask & COMPARE_PARTIAL_FLAG;
      convert || (convert = setToArray);

      if (object.size != other.size && !isPartial) {
        return false;
      }
      // Assume cyclic values are equal.
      var stacked = stack.get(object);
      if (stacked) {
        return stacked == other;
      }
      bitmask |= COMPARE_UNORDERED_FLAG;

      // Recursively compare objects (susceptible to call stack limits).
      stack.set(object, other);
      var result = equalArrays(convert(object), convert(other), bitmask, customizer, equalFunc, stack);
      stack['delete'](object);
      return result;

    case symbolTag:
      if (symbolValueOf) {
        return symbolValueOf.call(object) == symbolValueOf.call(other);
      }
  }
  return false;
}

module.exports = equalByTag;

},{"./_Symbol":15,"./_Uint8Array":16,"./_equalArrays":47,"./_mapToArray":81,"./_setToArray":92,"./eq":101}],49:[function(require,module,exports){
var getAllKeys = require('./_getAllKeys');

/** Used to compose bitmasks for value comparisons. */
var COMPARE_PARTIAL_FLAG = 1;

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * A specialized version of `baseIsEqualDeep` for objects with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} stack Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalObjects(object, other, bitmask, customizer, equalFunc, stack) {
  var isPartial = bitmask & COMPARE_PARTIAL_FLAG,
      objProps = getAllKeys(object),
      objLength = objProps.length,
      othProps = getAllKeys(other),
      othLength = othProps.length;

  if (objLength != othLength && !isPartial) {
    return false;
  }
  var index = objLength;
  while (index--) {
    var key = objProps[index];
    if (!(isPartial ? key in other : hasOwnProperty.call(other, key))) {
      return false;
    }
  }
  // Check that cyclic values are equal.
  var objStacked = stack.get(object);
  var othStacked = stack.get(other);
  if (objStacked && othStacked) {
    return objStacked == other && othStacked == object;
  }
  var result = true;
  stack.set(object, other);
  stack.set(other, object);

  var skipCtor = isPartial;
  while (++index < objLength) {
    key = objProps[index];
    var objValue = object[key],
        othValue = other[key];

    if (customizer) {
      var compared = isPartial
        ? customizer(othValue, objValue, key, other, object, stack)
        : customizer(objValue, othValue, key, object, other, stack);
    }
    // Recursively compare objects (susceptible to call stack limits).
    if (!(compared === undefined
          ? (objValue === othValue || equalFunc(objValue, othValue, bitmask, customizer, stack))
          : compared
        )) {
      result = false;
      break;
    }
    skipCtor || (skipCtor = key == 'constructor');
  }
  if (result && !skipCtor) {
    var objCtor = object.constructor,
        othCtor = other.constructor;

    // Non `Object` object instances with different constructors are not equal.
    if (objCtor != othCtor &&
        ('constructor' in object && 'constructor' in other) &&
        !(typeof objCtor == 'function' && objCtor instanceof objCtor &&
          typeof othCtor == 'function' && othCtor instanceof othCtor)) {
      result = false;
    }
  }
  stack['delete'](object);
  stack['delete'](other);
  return result;
}

module.exports = equalObjects;

},{"./_getAllKeys":51}],50:[function(require,module,exports){
(function (global){(function (){
/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

module.exports = freeGlobal;

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],51:[function(require,module,exports){
var baseGetAllKeys = require('./_baseGetAllKeys'),
    getSymbols = require('./_getSymbols'),
    keys = require('./keys');

/**
 * Creates an array of own enumerable property names and symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names and symbols.
 */
function getAllKeys(object) {
  return baseGetAllKeys(object, keys, getSymbols);
}

module.exports = getAllKeys;

},{"./_baseGetAllKeys":25,"./_getSymbols":56,"./keys":115}],52:[function(require,module,exports){
var isKeyable = require('./_isKeyable');

/**
 * Gets the data for `map`.
 *
 * @private
 * @param {Object} map The map to query.
 * @param {string} key The reference key.
 * @returns {*} Returns the map data.
 */
function getMapData(map, key) {
  var data = map.__data__;
  return isKeyable(key)
    ? data[typeof key == 'string' ? 'string' : 'hash']
    : data.map;
}

module.exports = getMapData;

},{"./_isKeyable":67}],53:[function(require,module,exports){
var isStrictComparable = require('./_isStrictComparable'),
    keys = require('./keys');

/**
 * Gets the property names, values, and compare flags of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the match data of `object`.
 */
function getMatchData(object) {
  var result = keys(object),
      length = result.length;

  while (length--) {
    var key = result[length],
        value = object[key];

    result[length] = [key, value, isStrictComparable(value)];
  }
  return result;
}

module.exports = getMatchData;

},{"./_isStrictComparable":70,"./keys":115}],54:[function(require,module,exports){
var baseIsNative = require('./_baseIsNative'),
    getValue = require('./_getValue');

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = getValue(object, key);
  return baseIsNative(value) ? value : undefined;
}

module.exports = getNative;

},{"./_baseIsNative":32,"./_getValue":58}],55:[function(require,module,exports){
var Symbol = require('./_Symbol');

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString = objectProto.toString;

/** Built-in value references. */
var symToStringTag = Symbol ? Symbol.toStringTag : undefined;

/**
 * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the raw `toStringTag`.
 */
function getRawTag(value) {
  var isOwn = hasOwnProperty.call(value, symToStringTag),
      tag = value[symToStringTag];

  try {
    value[symToStringTag] = undefined;
    var unmasked = true;
  } catch (e) {}

  var result = nativeObjectToString.call(value);
  if (unmasked) {
    if (isOwn) {
      value[symToStringTag] = tag;
    } else {
      delete value[symToStringTag];
    }
  }
  return result;
}

module.exports = getRawTag;

},{"./_Symbol":15}],56:[function(require,module,exports){
var arrayFilter = require('./_arrayFilter'),
    stubArray = require('./stubArray');

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Built-in value references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeGetSymbols = Object.getOwnPropertySymbols;

/**
 * Creates an array of the own enumerable symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of symbols.
 */
var getSymbols = !nativeGetSymbols ? stubArray : function(object) {
  if (object == null) {
    return [];
  }
  object = Object(object);
  return arrayFilter(nativeGetSymbols(object), function(symbol) {
    return propertyIsEnumerable.call(object, symbol);
  });
};

module.exports = getSymbols;

},{"./_arrayFilter":18,"./stubArray":119}],57:[function(require,module,exports){
var DataView = require('./_DataView'),
    Map = require('./_Map'),
    Promise = require('./_Promise'),
    Set = require('./_Set'),
    WeakMap = require('./_WeakMap'),
    baseGetTag = require('./_baseGetTag'),
    toSource = require('./_toSource');

/** `Object#toString` result references. */
var mapTag = '[object Map]',
    objectTag = '[object Object]',
    promiseTag = '[object Promise]',
    setTag = '[object Set]',
    weakMapTag = '[object WeakMap]';

var dataViewTag = '[object DataView]';

/** Used to detect maps, sets, and weakmaps. */
var dataViewCtorString = toSource(DataView),
    mapCtorString = toSource(Map),
    promiseCtorString = toSource(Promise),
    setCtorString = toSource(Set),
    weakMapCtorString = toSource(WeakMap);

/**
 * Gets the `toStringTag` of `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
var getTag = baseGetTag;

// Fallback for data views, maps, sets, and weak maps in IE 11 and promises in Node.js < 6.
if ((DataView && getTag(new DataView(new ArrayBuffer(1))) != dataViewTag) ||
    (Map && getTag(new Map) != mapTag) ||
    (Promise && getTag(Promise.resolve()) != promiseTag) ||
    (Set && getTag(new Set) != setTag) ||
    (WeakMap && getTag(new WeakMap) != weakMapTag)) {
  getTag = function(value) {
    var result = baseGetTag(value),
        Ctor = result == objectTag ? value.constructor : undefined,
        ctorString = Ctor ? toSource(Ctor) : '';

    if (ctorString) {
      switch (ctorString) {
        case dataViewCtorString: return dataViewTag;
        case mapCtorString: return mapTag;
        case promiseCtorString: return promiseTag;
        case setCtorString: return setTag;
        case weakMapCtorString: return weakMapTag;
      }
    }
    return result;
  };
}

module.exports = getTag;

},{"./_DataView":6,"./_Map":9,"./_Promise":11,"./_Set":12,"./_WeakMap":17,"./_baseGetTag":26,"./_toSource":100}],58:[function(require,module,exports){
/**
 * Gets the value at `key` of `object`.
 *
 * @private
 * @param {Object} [object] The object to query.
 * @param {string} key The key of the property to get.
 * @returns {*} Returns the property value.
 */
function getValue(object, key) {
  return object == null ? undefined : object[key];
}

module.exports = getValue;

},{}],59:[function(require,module,exports){
var castPath = require('./_castPath'),
    isArguments = require('./isArguments'),
    isArray = require('./isArray'),
    isIndex = require('./_isIndex'),
    isLength = require('./isLength'),
    toKey = require('./_toKey');

/**
 * Checks if `path` exists on `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} path The path to check.
 * @param {Function} hasFunc The function to check properties.
 * @returns {boolean} Returns `true` if `path` exists, else `false`.
 */
function hasPath(object, path, hasFunc) {
  path = castPath(path, object);

  var index = -1,
      length = path.length,
      result = false;

  while (++index < length) {
    var key = toKey(path[index]);
    if (!(result = object != null && hasFunc(object, key))) {
      break;
    }
    object = object[key];
  }
  if (result || ++index != length) {
    return result;
  }
  length = object == null ? 0 : object.length;
  return !!length && isLength(length) && isIndex(key, length) &&
    (isArray(object) || isArguments(object));
}

module.exports = hasPath;

},{"./_castPath":45,"./_isIndex":65,"./_toKey":99,"./isArguments":105,"./isArray":106,"./isLength":110}],60:[function(require,module,exports){
var nativeCreate = require('./_nativeCreate');

/**
 * Removes all key-value entries from the hash.
 *
 * @private
 * @name clear
 * @memberOf Hash
 */
function hashClear() {
  this.__data__ = nativeCreate ? nativeCreate(null) : {};
  this.size = 0;
}

module.exports = hashClear;

},{"./_nativeCreate":84}],61:[function(require,module,exports){
/**
 * Removes `key` and its value from the hash.
 *
 * @private
 * @name delete
 * @memberOf Hash
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function hashDelete(key) {
  var result = this.has(key) && delete this.__data__[key];
  this.size -= result ? 1 : 0;
  return result;
}

module.exports = hashDelete;

},{}],62:[function(require,module,exports){
var nativeCreate = require('./_nativeCreate');

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Gets the hash value for `key`.
 *
 * @private
 * @name get
 * @memberOf Hash
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function hashGet(key) {
  var data = this.__data__;
  if (nativeCreate) {
    var result = data[key];
    return result === HASH_UNDEFINED ? undefined : result;
  }
  return hasOwnProperty.call(data, key) ? data[key] : undefined;
}

module.exports = hashGet;

},{"./_nativeCreate":84}],63:[function(require,module,exports){
var nativeCreate = require('./_nativeCreate');

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Checks if a hash value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Hash
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function hashHas(key) {
  var data = this.__data__;
  return nativeCreate ? (data[key] !== undefined) : hasOwnProperty.call(data, key);
}

module.exports = hashHas;

},{"./_nativeCreate":84}],64:[function(require,module,exports){
var nativeCreate = require('./_nativeCreate');

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/**
 * Sets the hash `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Hash
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the hash instance.
 */
function hashSet(key, value) {
  var data = this.__data__;
  this.size += this.has(key) ? 0 : 1;
  data[key] = (nativeCreate && value === undefined) ? HASH_UNDEFINED : value;
  return this;
}

module.exports = hashSet;

},{"./_nativeCreate":84}],65:[function(require,module,exports){
/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  var type = typeof value;
  length = length == null ? MAX_SAFE_INTEGER : length;

  return !!length &&
    (type == 'number' ||
      (type != 'symbol' && reIsUint.test(value))) &&
        (value > -1 && value % 1 == 0 && value < length);
}

module.exports = isIndex;

},{}],66:[function(require,module,exports){
var isArray = require('./isArray'),
    isSymbol = require('./isSymbol');

/** Used to match property names within property paths. */
var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,
    reIsPlainProp = /^\w*$/;

/**
 * Checks if `value` is a property name and not a property path.
 *
 * @private
 * @param {*} value The value to check.
 * @param {Object} [object] The object to query keys on.
 * @returns {boolean} Returns `true` if `value` is a property name, else `false`.
 */
function isKey(value, object) {
  if (isArray(value)) {
    return false;
  }
  var type = typeof value;
  if (type == 'number' || type == 'symbol' || type == 'boolean' ||
      value == null || isSymbol(value)) {
    return true;
  }
  return reIsPlainProp.test(value) || !reIsDeepProp.test(value) ||
    (object != null && value in Object(object));
}

module.exports = isKey;

},{"./isArray":106,"./isSymbol":113}],67:[function(require,module,exports){
/**
 * Checks if `value` is suitable for use as unique object key.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
 */
function isKeyable(value) {
  var type = typeof value;
  return (type == 'string' || type == 'number' || type == 'symbol' || type == 'boolean')
    ? (value !== '__proto__')
    : (value === null);
}

module.exports = isKeyable;

},{}],68:[function(require,module,exports){
var coreJsData = require('./_coreJsData');

/** Used to detect methods masquerading as native. */
var maskSrcKey = (function() {
  var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || '');
  return uid ? ('Symbol(src)_1.' + uid) : '';
}());

/**
 * Checks if `func` has its source masked.
 *
 * @private
 * @param {Function} func The function to check.
 * @returns {boolean} Returns `true` if `func` is masked, else `false`.
 */
function isMasked(func) {
  return !!maskSrcKey && (maskSrcKey in func);
}

module.exports = isMasked;

},{"./_coreJsData":46}],69:[function(require,module,exports){
/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

  return value === proto;
}

module.exports = isPrototype;

},{}],70:[function(require,module,exports){
var isObject = require('./isObject');

/**
 * Checks if `value` is suitable for strict equality comparisons, i.e. `===`.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` if suitable for strict
 *  equality comparisons, else `false`.
 */
function isStrictComparable(value) {
  return value === value && !isObject(value);
}

module.exports = isStrictComparable;

},{"./isObject":111}],71:[function(require,module,exports){
/**
 * Removes all key-value entries from the list cache.
 *
 * @private
 * @name clear
 * @memberOf ListCache
 */
function listCacheClear() {
  this.__data__ = [];
  this.size = 0;
}

module.exports = listCacheClear;

},{}],72:[function(require,module,exports){
var assocIndexOf = require('./_assocIndexOf');

/** Used for built-in method references. */
var arrayProto = Array.prototype;

/** Built-in value references. */
var splice = arrayProto.splice;

/**
 * Removes `key` and its value from the list cache.
 *
 * @private
 * @name delete
 * @memberOf ListCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function listCacheDelete(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  if (index < 0) {
    return false;
  }
  var lastIndex = data.length - 1;
  if (index == lastIndex) {
    data.pop();
  } else {
    splice.call(data, index, 1);
  }
  --this.size;
  return true;
}

module.exports = listCacheDelete;

},{"./_assocIndexOf":23}],73:[function(require,module,exports){
var assocIndexOf = require('./_assocIndexOf');

/**
 * Gets the list cache value for `key`.
 *
 * @private
 * @name get
 * @memberOf ListCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function listCacheGet(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  return index < 0 ? undefined : data[index][1];
}

module.exports = listCacheGet;

},{"./_assocIndexOf":23}],74:[function(require,module,exports){
var assocIndexOf = require('./_assocIndexOf');

/**
 * Checks if a list cache value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf ListCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function listCacheHas(key) {
  return assocIndexOf(this.__data__, key) > -1;
}

module.exports = listCacheHas;

},{"./_assocIndexOf":23}],75:[function(require,module,exports){
var assocIndexOf = require('./_assocIndexOf');

/**
 * Sets the list cache `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf ListCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the list cache instance.
 */
function listCacheSet(key, value) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  if (index < 0) {
    ++this.size;
    data.push([key, value]);
  } else {
    data[index][1] = value;
  }
  return this;
}

module.exports = listCacheSet;

},{"./_assocIndexOf":23}],76:[function(require,module,exports){
var Hash = require('./_Hash'),
    ListCache = require('./_ListCache'),
    Map = require('./_Map');

/**
 * Removes all key-value entries from the map.
 *
 * @private
 * @name clear
 * @memberOf MapCache
 */
function mapCacheClear() {
  this.size = 0;
  this.__data__ = {
    'hash': new Hash,
    'map': new (Map || ListCache),
    'string': new Hash
  };
}

module.exports = mapCacheClear;

},{"./_Hash":7,"./_ListCache":8,"./_Map":9}],77:[function(require,module,exports){
var getMapData = require('./_getMapData');

/**
 * Removes `key` and its value from the map.
 *
 * @private
 * @name delete
 * @memberOf MapCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function mapCacheDelete(key) {
  var result = getMapData(this, key)['delete'](key);
  this.size -= result ? 1 : 0;
  return result;
}

module.exports = mapCacheDelete;

},{"./_getMapData":52}],78:[function(require,module,exports){
var getMapData = require('./_getMapData');

/**
 * Gets the map value for `key`.
 *
 * @private
 * @name get
 * @memberOf MapCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function mapCacheGet(key) {
  return getMapData(this, key).get(key);
}

module.exports = mapCacheGet;

},{"./_getMapData":52}],79:[function(require,module,exports){
var getMapData = require('./_getMapData');

/**
 * Checks if a map value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf MapCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function mapCacheHas(key) {
  return getMapData(this, key).has(key);
}

module.exports = mapCacheHas;

},{"./_getMapData":52}],80:[function(require,module,exports){
var getMapData = require('./_getMapData');

/**
 * Sets the map `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf MapCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the map cache instance.
 */
function mapCacheSet(key, value) {
  var data = getMapData(this, key),
      size = data.size;

  data.set(key, value);
  this.size += data.size == size ? 0 : 1;
  return this;
}

module.exports = mapCacheSet;

},{"./_getMapData":52}],81:[function(require,module,exports){
/**
 * Converts `map` to its key-value pairs.
 *
 * @private
 * @param {Object} map The map to convert.
 * @returns {Array} Returns the key-value pairs.
 */
function mapToArray(map) {
  var index = -1,
      result = Array(map.size);

  map.forEach(function(value, key) {
    result[++index] = [key, value];
  });
  return result;
}

module.exports = mapToArray;

},{}],82:[function(require,module,exports){
/**
 * A specialized version of `matchesProperty` for source values suitable
 * for strict equality comparisons, i.e. `===`.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @param {*} srcValue The value to match.
 * @returns {Function} Returns the new spec function.
 */
function matchesStrictComparable(key, srcValue) {
  return function(object) {
    if (object == null) {
      return false;
    }
    return object[key] === srcValue &&
      (srcValue !== undefined || (key in Object(object)));
  };
}

module.exports = matchesStrictComparable;

},{}],83:[function(require,module,exports){
var memoize = require('./memoize');

/** Used as the maximum memoize cache size. */
var MAX_MEMOIZE_SIZE = 500;

/**
 * A specialized version of `_.memoize` which clears the memoized function's
 * cache when it exceeds `MAX_MEMOIZE_SIZE`.
 *
 * @private
 * @param {Function} func The function to have its output memoized.
 * @returns {Function} Returns the new memoized function.
 */
function memoizeCapped(func) {
  var result = memoize(func, function(key) {
    if (cache.size === MAX_MEMOIZE_SIZE) {
      cache.clear();
    }
    return key;
  });

  var cache = result.cache;
  return result;
}

module.exports = memoizeCapped;

},{"./memoize":116}],84:[function(require,module,exports){
var getNative = require('./_getNative');

/* Built-in method references that are verified to be native. */
var nativeCreate = getNative(Object, 'create');

module.exports = nativeCreate;

},{"./_getNative":54}],85:[function(require,module,exports){
var overArg = require('./_overArg');

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeKeys = overArg(Object.keys, Object);

module.exports = nativeKeys;

},{"./_overArg":88}],86:[function(require,module,exports){
var freeGlobal = require('./_freeGlobal');

/** Detect free variable `exports`. */
var freeExports = typeof exports == 'object' && exports && !exports.nodeType && exports;

/** Detect free variable `module`. */
var freeModule = freeExports && typeof module == 'object' && module && !module.nodeType && module;

/** Detect the popular CommonJS extension `module.exports`. */
var moduleExports = freeModule && freeModule.exports === freeExports;

/** Detect free variable `process` from Node.js. */
var freeProcess = moduleExports && freeGlobal.process;

/** Used to access faster Node.js helpers. */
var nodeUtil = (function() {
  try {
    // Use `util.types` for Node.js 10+.
    var types = freeModule && freeModule.require && freeModule.require('util').types;

    if (types) {
      return types;
    }

    // Legacy `process.binding('util')` for Node.js < 10.
    return freeProcess && freeProcess.binding && freeProcess.binding('util');
  } catch (e) {}
}());

module.exports = nodeUtil;

},{"./_freeGlobal":50}],87:[function(require,module,exports){
/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString = objectProto.toString;

/**
 * Converts `value` to a string using `Object.prototype.toString`.
 *
 * @private
 * @param {*} value The value to convert.
 * @returns {string} Returns the converted string.
 */
function objectToString(value) {
  return nativeObjectToString.call(value);
}

module.exports = objectToString;

},{}],88:[function(require,module,exports){
/**
 * Creates a unary function that invokes `func` with its argument transformed.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {Function} transform The argument transform.
 * @returns {Function} Returns the new function.
 */
function overArg(func, transform) {
  return function(arg) {
    return func(transform(arg));
  };
}

module.exports = overArg;

},{}],89:[function(require,module,exports){
var freeGlobal = require('./_freeGlobal');

/** Detect free variable `self`. */
var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

/** Used as a reference to the global object. */
var root = freeGlobal || freeSelf || Function('return this')();

module.exports = root;

},{"./_freeGlobal":50}],90:[function(require,module,exports){
/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/**
 * Adds `value` to the array cache.
 *
 * @private
 * @name add
 * @memberOf SetCache
 * @alias push
 * @param {*} value The value to cache.
 * @returns {Object} Returns the cache instance.
 */
function setCacheAdd(value) {
  this.__data__.set(value, HASH_UNDEFINED);
  return this;
}

module.exports = setCacheAdd;

},{}],91:[function(require,module,exports){
/**
 * Checks if `value` is in the array cache.
 *
 * @private
 * @name has
 * @memberOf SetCache
 * @param {*} value The value to search for.
 * @returns {number} Returns `true` if `value` is found, else `false`.
 */
function setCacheHas(value) {
  return this.__data__.has(value);
}

module.exports = setCacheHas;

},{}],92:[function(require,module,exports){
/**
 * Converts `set` to an array of its values.
 *
 * @private
 * @param {Object} set The set to convert.
 * @returns {Array} Returns the values.
 */
function setToArray(set) {
  var index = -1,
      result = Array(set.size);

  set.forEach(function(value) {
    result[++index] = value;
  });
  return result;
}

module.exports = setToArray;

},{}],93:[function(require,module,exports){
var ListCache = require('./_ListCache');

/**
 * Removes all key-value entries from the stack.
 *
 * @private
 * @name clear
 * @memberOf Stack
 */
function stackClear() {
  this.__data__ = new ListCache;
  this.size = 0;
}

module.exports = stackClear;

},{"./_ListCache":8}],94:[function(require,module,exports){
/**
 * Removes `key` and its value from the stack.
 *
 * @private
 * @name delete
 * @memberOf Stack
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function stackDelete(key) {
  var data = this.__data__,
      result = data['delete'](key);

  this.size = data.size;
  return result;
}

module.exports = stackDelete;

},{}],95:[function(require,module,exports){
/**
 * Gets the stack value for `key`.
 *
 * @private
 * @name get
 * @memberOf Stack
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function stackGet(key) {
  return this.__data__.get(key);
}

module.exports = stackGet;

},{}],96:[function(require,module,exports){
/**
 * Checks if a stack value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Stack
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function stackHas(key) {
  return this.__data__.has(key);
}

module.exports = stackHas;

},{}],97:[function(require,module,exports){
var ListCache = require('./_ListCache'),
    Map = require('./_Map'),
    MapCache = require('./_MapCache');

/** Used as the size to enable large array optimizations. */
var LARGE_ARRAY_SIZE = 200;

/**
 * Sets the stack `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Stack
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the stack cache instance.
 */
function stackSet(key, value) {
  var data = this.__data__;
  if (data instanceof ListCache) {
    var pairs = data.__data__;
    if (!Map || (pairs.length < LARGE_ARRAY_SIZE - 1)) {
      pairs.push([key, value]);
      this.size = ++data.size;
      return this;
    }
    data = this.__data__ = new MapCache(pairs);
  }
  data.set(key, value);
  this.size = data.size;
  return this;
}

module.exports = stackSet;

},{"./_ListCache":8,"./_Map":9,"./_MapCache":10}],98:[function(require,module,exports){
var memoizeCapped = require('./_memoizeCapped');

/** Used to match property names within property paths. */
var rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;

/** Used to match backslashes in property paths. */
var reEscapeChar = /\\(\\)?/g;

/**
 * Converts `string` to a property path array.
 *
 * @private
 * @param {string} string The string to convert.
 * @returns {Array} Returns the property path array.
 */
var stringToPath = memoizeCapped(function(string) {
  var result = [];
  if (string.charCodeAt(0) === 46 /* . */) {
    result.push('');
  }
  string.replace(rePropName, function(match, number, quote, subString) {
    result.push(quote ? subString.replace(reEscapeChar, '$1') : (number || match));
  });
  return result;
});

module.exports = stringToPath;

},{"./_memoizeCapped":83}],99:[function(require,module,exports){
var isSymbol = require('./isSymbol');

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0;

/**
 * Converts `value` to a string key if it's not a string or symbol.
 *
 * @private
 * @param {*} value The value to inspect.
 * @returns {string|symbol} Returns the key.
 */
function toKey(value) {
  if (typeof value == 'string' || isSymbol(value)) {
    return value;
  }
  var result = (value + '');
  return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
}

module.exports = toKey;

},{"./isSymbol":113}],100:[function(require,module,exports){
/** Used for built-in method references. */
var funcProto = Function.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString;

/**
 * Converts `func` to its source code.
 *
 * @private
 * @param {Function} func The function to convert.
 * @returns {string} Returns the source code.
 */
function toSource(func) {
  if (func != null) {
    try {
      return funcToString.call(func);
    } catch (e) {}
    try {
      return (func + '');
    } catch (e) {}
  }
  return '';
}

module.exports = toSource;

},{}],101:[function(require,module,exports){
/**
 * Performs a
 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

module.exports = eq;

},{}],102:[function(require,module,exports){
var baseGet = require('./_baseGet');

/**
 * Gets the value at `path` of `object`. If the resolved value is
 * `undefined`, the `defaultValue` is returned in its place.
 *
 * @static
 * @memberOf _
 * @since 3.7.0
 * @category Object
 * @param {Object} object The object to query.
 * @param {Array|string} path The path of the property to get.
 * @param {*} [defaultValue] The value returned for `undefined` resolved values.
 * @returns {*} Returns the resolved value.
 * @example
 *
 * var object = { 'a': [{ 'b': { 'c': 3 } }] };
 *
 * _.get(object, 'a[0].b.c');
 * // => 3
 *
 * _.get(object, ['a', '0', 'b', 'c']);
 * // => 3
 *
 * _.get(object, 'a.b.c', 'default');
 * // => 'default'
 */
function get(object, path, defaultValue) {
  var result = object == null ? undefined : baseGet(object, path);
  return result === undefined ? defaultValue : result;
}

module.exports = get;

},{"./_baseGet":24}],103:[function(require,module,exports){
var baseHasIn = require('./_baseHasIn'),
    hasPath = require('./_hasPath');

/**
 * Checks if `path` is a direct or inherited property of `object`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Object
 * @param {Object} object The object to query.
 * @param {Array|string} path The path to check.
 * @returns {boolean} Returns `true` if `path` exists, else `false`.
 * @example
 *
 * var object = _.create({ 'a': _.create({ 'b': 2 }) });
 *
 * _.hasIn(object, 'a');
 * // => true
 *
 * _.hasIn(object, 'a.b');
 * // => true
 *
 * _.hasIn(object, ['a', 'b']);
 * // => true
 *
 * _.hasIn(object, 'b');
 * // => false
 */
function hasIn(object, path) {
  return object != null && hasPath(object, path, baseHasIn);
}

module.exports = hasIn;

},{"./_baseHasIn":27,"./_hasPath":59}],104:[function(require,module,exports){
/**
 * This method returns the first argument it receives.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Util
 * @param {*} value Any value.
 * @returns {*} Returns `value`.
 * @example
 *
 * var object = { 'a': 1 };
 *
 * console.log(_.identity(object) === object);
 * // => true
 */
function identity(value) {
  return value;
}

module.exports = identity;

},{}],105:[function(require,module,exports){
var baseIsArguments = require('./_baseIsArguments'),
    isObjectLike = require('./isObjectLike');

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Built-in value references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 *  else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
var isArguments = baseIsArguments(function() { return arguments; }()) ? baseIsArguments : function(value) {
  return isObjectLike(value) && hasOwnProperty.call(value, 'callee') &&
    !propertyIsEnumerable.call(value, 'callee');
};

module.exports = isArguments;

},{"./_baseIsArguments":28,"./isObjectLike":112}],106:[function(require,module,exports){
/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

module.exports = isArray;

},{}],107:[function(require,module,exports){
var isFunction = require('./isFunction'),
    isLength = require('./isLength');

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null && isLength(value.length) && !isFunction(value);
}

module.exports = isArrayLike;

},{"./isFunction":109,"./isLength":110}],108:[function(require,module,exports){
var root = require('./_root'),
    stubFalse = require('./stubFalse');

/** Detect free variable `exports`. */
var freeExports = typeof exports == 'object' && exports && !exports.nodeType && exports;

/** Detect free variable `module`. */
var freeModule = freeExports && typeof module == 'object' && module && !module.nodeType && module;

/** Detect the popular CommonJS extension `module.exports`. */
var moduleExports = freeModule && freeModule.exports === freeExports;

/** Built-in value references. */
var Buffer = moduleExports ? root.Buffer : undefined;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined;

/**
 * Checks if `value` is a buffer.
 *
 * @static
 * @memberOf _
 * @since 4.3.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
 * @example
 *
 * _.isBuffer(new Buffer(2));
 * // => true
 *
 * _.isBuffer(new Uint8Array(2));
 * // => false
 */
var isBuffer = nativeIsBuffer || stubFalse;

module.exports = isBuffer;

},{"./_root":89,"./stubFalse":120}],109:[function(require,module,exports){
var baseGetTag = require('./_baseGetTag'),
    isObject = require('./isObject');

/** `Object#toString` result references. */
var asyncTag = '[object AsyncFunction]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    proxyTag = '[object Proxy]';

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  if (!isObject(value)) {
    return false;
  }
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 9 which returns 'object' for typed arrays and other constructors.
  var tag = baseGetTag(value);
  return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
}

module.exports = isFunction;

},{"./_baseGetTag":26,"./isObject":111}],110:[function(require,module,exports){
/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This method is loosely based on
 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

module.exports = isLength;

},{}],111:[function(require,module,exports){
/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return value != null && (type == 'object' || type == 'function');
}

module.exports = isObject;

},{}],112:[function(require,module,exports){
/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return value != null && typeof value == 'object';
}

module.exports = isObjectLike;

},{}],113:[function(require,module,exports){
var baseGetTag = require('./_baseGetTag'),
    isObjectLike = require('./isObjectLike');

/** `Object#toString` result references. */
var symbolTag = '[object Symbol]';

/**
 * Checks if `value` is classified as a `Symbol` primitive or object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
 * @example
 *
 * _.isSymbol(Symbol.iterator);
 * // => true
 *
 * _.isSymbol('abc');
 * // => false
 */
function isSymbol(value) {
  return typeof value == 'symbol' ||
    (isObjectLike(value) && baseGetTag(value) == symbolTag);
}

module.exports = isSymbol;

},{"./_baseGetTag":26,"./isObjectLike":112}],114:[function(require,module,exports){
var baseIsTypedArray = require('./_baseIsTypedArray'),
    baseUnary = require('./_baseUnary'),
    nodeUtil = require('./_nodeUtil');

/* Node.js helper references. */
var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;

/**
 * Checks if `value` is classified as a typed array.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 * @example
 *
 * _.isTypedArray(new Uint8Array);
 * // => true
 *
 * _.isTypedArray([]);
 * // => false
 */
var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;

module.exports = isTypedArray;

},{"./_baseIsTypedArray":33,"./_baseUnary":43,"./_nodeUtil":86}],115:[function(require,module,exports){
var arrayLikeKeys = require('./_arrayLikeKeys'),
    baseKeys = require('./_baseKeys'),
    isArrayLike = require('./isArrayLike');

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
function keys(object) {
  return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
}

module.exports = keys;

},{"./_arrayLikeKeys":19,"./_baseKeys":35,"./isArrayLike":107}],116:[function(require,module,exports){
var MapCache = require('./_MapCache');

/** Error message constants. */
var FUNC_ERROR_TEXT = 'Expected a function';

/**
 * Creates a function that memoizes the result of `func`. If `resolver` is
 * provided, it determines the cache key for storing the result based on the
 * arguments provided to the memoized function. By default, the first argument
 * provided to the memoized function is used as the map cache key. The `func`
 * is invoked with the `this` binding of the memoized function.
 *
 * **Note:** The cache is exposed as the `cache` property on the memoized
 * function. Its creation may be customized by replacing the `_.memoize.Cache`
 * constructor with one whose instances implement the
 * [`Map`](http://ecma-international.org/ecma-262/7.0/#sec-properties-of-the-map-prototype-object)
 * method interface of `clear`, `delete`, `get`, `has`, and `set`.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Function
 * @param {Function} func The function to have its output memoized.
 * @param {Function} [resolver] The function to resolve the cache key.
 * @returns {Function} Returns the new memoized function.
 * @example
 *
 * var object = { 'a': 1, 'b': 2 };
 * var other = { 'c': 3, 'd': 4 };
 *
 * var values = _.memoize(_.values);
 * values(object);
 * // => [1, 2]
 *
 * values(other);
 * // => [3, 4]
 *
 * object.a = 2;
 * values(object);
 * // => [1, 2]
 *
 * // Modify the result cache.
 * values.cache.set(object, ['a', 'b']);
 * values(object);
 * // => ['a', 'b']
 *
 * // Replace `_.memoize.Cache`.
 * _.memoize.Cache = WeakMap;
 */
function memoize(func, resolver) {
  if (typeof func != 'function' || (resolver != null && typeof resolver != 'function')) {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  var memoized = function() {
    var args = arguments,
        key = resolver ? resolver.apply(this, args) : args[0],
        cache = memoized.cache;

    if (cache.has(key)) {
      return cache.get(key);
    }
    var result = func.apply(this, args);
    memoized.cache = cache.set(key, result) || cache;
    return result;
  };
  memoized.cache = new (memoize.Cache || MapCache);
  return memoized;
}

// Expose `MapCache`.
memoize.Cache = MapCache;

module.exports = memoize;

},{"./_MapCache":10}],117:[function(require,module,exports){
var baseProperty = require('./_baseProperty'),
    basePropertyDeep = require('./_basePropertyDeep'),
    isKey = require('./_isKey'),
    toKey = require('./_toKey');

/**
 * Creates a function that returns the value at `path` of a given object.
 *
 * @static
 * @memberOf _
 * @since 2.4.0
 * @category Util
 * @param {Array|string} path The path of the property to get.
 * @returns {Function} Returns the new accessor function.
 * @example
 *
 * var objects = [
 *   { 'a': { 'b': 2 } },
 *   { 'a': { 'b': 1 } }
 * ];
 *
 * _.map(objects, _.property('a.b'));
 * // => [2, 1]
 *
 * _.map(_.sortBy(objects, _.property(['a', 'b'])), 'a.b');
 * // => [1, 2]
 */
function property(path) {
  return isKey(path) ? baseProperty(toKey(path)) : basePropertyDeep(path);
}

module.exports = property;

},{"./_baseProperty":38,"./_basePropertyDeep":39,"./_isKey":66,"./_toKey":99}],118:[function(require,module,exports){
var baseIteratee = require('./_baseIteratee'),
    baseSortedIndexBy = require('./_baseSortedIndexBy');

/**
 * This method is like `_.sortedIndex` except that it accepts `iteratee`
 * which is invoked for `value` and each element of `array` to compute their
 * sort ranking. The iteratee is invoked with one argument: (value).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Array
 * @param {Array} array The sorted array to inspect.
 * @param {*} value The value to evaluate.
 * @param {Function} [iteratee=_.identity] The iteratee invoked per element.
 * @returns {number} Returns the index at which `value` should be inserted
 *  into `array`.
 * @example
 *
 * var objects = [{ 'x': 4 }, { 'x': 5 }];
 *
 * _.sortedIndexBy(objects, { 'x': 4 }, function(o) { return o.x; });
 * // => 0
 *
 * // The `_.property` iteratee shorthand.
 * _.sortedIndexBy(objects, { 'x': 4 }, 'x');
 * // => 0
 */
function sortedIndexBy(array, value, iteratee) {
  return baseSortedIndexBy(array, value, baseIteratee(iteratee, 2));
}

module.exports = sortedIndexBy;

},{"./_baseIteratee":34,"./_baseSortedIndexBy":40}],119:[function(require,module,exports){
/**
 * This method returns a new empty array.
 *
 * @static
 * @memberOf _
 * @since 4.13.0
 * @category Util
 * @returns {Array} Returns the new empty array.
 * @example
 *
 * var arrays = _.times(2, _.stubArray);
 *
 * console.log(arrays);
 * // => [[], []]
 *
 * console.log(arrays[0] === arrays[1]);
 * // => false
 */
function stubArray() {
  return [];
}

module.exports = stubArray;

},{}],120:[function(require,module,exports){
/**
 * This method returns `false`.
 *
 * @static
 * @memberOf _
 * @since 4.13.0
 * @category Util
 * @returns {boolean} Returns `false`.
 * @example
 *
 * _.times(2, _.stubFalse);
 * // => [false, false]
 */
function stubFalse() {
  return false;
}

module.exports = stubFalse;

},{}],121:[function(require,module,exports){
var baseToString = require('./_baseToString');

/**
 * Converts `value` to a string. An empty string is returned for `null`
 * and `undefined` values. The sign of `-0` is preserved.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {string} Returns the converted string.
 * @example
 *
 * _.toString(null);
 * // => ''
 *
 * _.toString(-0);
 * // => '-0'
 *
 * _.toString([1, 2, 3]);
 * // => '1,2,3'
 */
function toString(value) {
  return value == null ? '' : baseToString(value);
}

module.exports = toString;

},{"./_baseToString":42}],122:[function(require,module,exports){
"use strict";

var LineRiderEngine = _interopRequireWildcard(require("./src/line-rider-engine/index.js"));

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function moduleEventHandler(e) {
  let engine = new LineRiderEngine.default();
  let track = e.detail.track;
  let engineFromTrack = engine.setStart(track.startPosition).addLine(track.lines.map(LineRiderEngine.createLineFromJson));
  let movements = {
    "movements": []
  };

  for (let i = 0; i < e.detail.frames; i += 1) {
    var rider = engineFromTrack.getRider(i);
    var x = rider.position.x;
    var y = rider.position.y;
    movements.movements.push({
      x,
      y
    });
  }

  const module2htmlEvent = new CustomEvent('module2html', {
    detail: movements
  });
  document.dispatchEvent(module2htmlEvent);
}

document.addEventListener('html2module', moduleEventHandler, false);

},{"./src/line-rider-engine/index.js":136}],123:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.lineLineIntersection = lineLineIntersection;
exports.lineInBox = lineInBox;
exports.lineInBoxOrdered = lineInBoxOrdered;
exports.pointLineDistance = pointLineDistance;
exports.pointLineDistanceSquared = pointLineDistanceSquared;

/**
 * line 1 endpoints: (x0, y0), (x1, y1)
 * line 2 endpoints: (x2, y2), (x3, y3)
 * inclusive: include edge cases e.g. endpoint touching an edge or on a point (default false)
 *
 * returns:
 * if: there is an intersection
 * then: a value between 0 and 1 describing the position of intersection on line 1
 *   or true if lines are collinear and inclusive is true (undefined point of intersectoin)
 * else: null
 */
function lineLineIntersection(x0, y0, x1, y1, x2, y2, x3, y3, inclusive) {
  const x01 = x1 - x0;
  const y01 = y1 - y0;
  const x23 = x3 - x2;
  const y23 = y3 - y2;

  const _01cross23 = x01 * y23 - x23 * y01;

  if (_01cross23 === 0) {
    // collinear
    return inclusive ? true : null;
  }

  const orientation = _01cross23 > 0;
  const x02 = x2 - x0;
  const y02 = y2 - y0;

  const _02cross01 = x02 * y01 - y02 * x01;

  if (_02cross01 === 0 ? !inclusive : _02cross01 < 0 === orientation) {
    return null;
  }

  const _02cross23 = x02 * y23 - y02 * x23;

  if (_02cross23 === 0 ? !inclusive : _02cross23 < 0 === orientation) {
    return null;
  }

  if (_02cross01 === _01cross23 ? !inclusive : _02cross01 > _01cross23 === orientation) {
    return null;
  }

  if (_02cross23 === _01cross23 ? !inclusive : _02cross23 > _01cross23 === orientation) {
    return null;
  }

  return _02cross23 / _01cross23;
}
/**
 * line endpoints: (x0, y0), (x1, y1)
 * box corners diagonal from each other: (x2, y2), (x3, y3)
 * inclusive: include edge cases e.g. endpoint touching the box edge or corner (default false)
 *
 * returns true if the line is contained within or intersects with the box, false otherwise
 */


function lineInBox(x0, y0, x1, y1, x2, y2, x3, y3, inclusive) {
  if (x2 < x3) {
    if (y2 < y3) {
      return lineInBoxOrdered(x0, y0, x1, y1, x2, y2, x3, y3, inclusive);
    } else {
      return lineInBoxOrdered(x0, y0, x1, y1, x2, y3, x3, y2, inclusive);
    }
  } else {
    if (y2 < y3) {
      return lineInBoxOrdered(x0, y0, x1, y1, x3, y2, x2, y3, inclusive);
    } else {
      return lineInBoxOrdered(x0, y0, x1, y1, x3, y3, x2, y2, inclusive);
    }
  }
}
/**
 * same as lineInBox except
 * (x2, y2) is the top-left corner of the box
 * (x3, y3) is the bottom-right corner of the box
 */


function lineInBoxOrdered(x0, y0, x1, y1, x2, y2, x3, y3, inclusive) {
  let L0, R0, T0, B0, L1, R1, T1, B1;

  if (inclusive) {
    L0 = x0 < x2;
    R0 = x0 > x3;
    T0 = y0 < y2;
    B0 = y0 > y3;
    L1 = x1 < x2;
    R1 = x1 > x3;
    T1 = y1 < y2;
    B1 = y1 > y3;
  } else {
    L0 = x0 <= x2;
    R0 = x0 >= x3;
    T0 = y0 <= y2;
    B0 = y0 >= y3;
    L1 = x1 <= x2;
    R1 = x1 >= x3;
    T1 = y1 <= y2;
    B1 = y1 >= y3;
  } // both endpoints are totally on one side of the box


  if (L0 && L1 || R0 && R1 || T0 && T1 || B0 && B1) {
    return false;
  } // both endpoints are not on one side of the box
  // but between left/right or top/bottom sides
  // or one point inside


  if (!L0 && !R0 && (!T0 && !B0 || !L1 && !R1) || !T1 && !B1 && (!L1 && !R1 || !T0 && !B0)) {
    return true;
  } // TL - BR


  if ((L0 || B0 || R1 || T1) && (R0 || T0 || L1 || B1)) {
    return lineLineIntersection(x0, y0, x1, y1, x2, y3, x3, y2, inclusive) !== null;
  } else {
    // TR - BL
    return lineLineIntersection(x0, y0, x1, y1, x2, y2, x3, y3, inclusive) !== null;
  }
}
/**
 * point: (x0, y0)
 * line endpoints: (x1, y1), (x2, y2)
 *
 * returns: the closest distance between the point and the line segment
 */


function pointLineDistance(x0, y0, x1, y1, x2, y2) {
  return Math.sqrt(pointLineDistanceSquared(x0, y0, x1, y1, x2, y2));
}

function pointLineDistanceSquared(x0, y0, x1, y1, x2, y2) {
  const x12 = x2 - x1;
  const y12 = y2 - y1;
  const x10 = x0 - x1;
  const y10 = y0 - y1;
  const dot = x10 * x12 + y10 * y12;

  if (dot <= 0) {
    return x10 * x10 + y10 * y10;
  }

  const lengthSq = x12 * x12 + y12 * y12;

  if (dot >= lengthSq) {
    const x20 = x0 - x2;
    const y20 = y0 - y2;
    return x20 * x20 + y20 * y20;
  }

  const cross = x10 * y12 - y10 * x12;
  return cross * cross / lengthSq;
}

},{}],124:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.setupImmo = setupImmo;
exports.default = void 0;

/**
 * Immo: Immutable Manually Managed Object
 *
 * props: immutable properties. these stay the same
 * state: immutable state. these get updated via updateState()
 * computed: mutable derived data. make them up to date via updateComputed()
 * update: object mapping computed props to update fns
 *
 * usage:
 * - @setupImmo
 * - class MyClass extends Immo {}
 * - // setupImmo(MyClass) if you dont have decorators
 *
 * instance = new MyClass(props, state, computed)
 * nextInstance = instance.updateState(nextState)
 *
 * you can also subclass your Immo subclass.
 * just remember to @setupImmo the subsubclass if you want to add more immo properties
 *
 */
class Immo {
  static __props__() {
    return {};
  }

  static __state__() {
    return {};
  }

  static __computed__() {
    return {};
  }

  static get __update__() {
    return {};
  }

  constructor({
    props,
    state,
    computed
  } = {}) {
    let current = this;
    Object.defineProperties(this, {
      __init__: {
        value: this
      },
      __current__: {
        get: () => current,
        set: next => {
          current = next;
        }
      },
      __props__: {
        value: Object.assign(this.constructor.__props__.call(this), props)
      },
      __state__: {
        value: Object.assign(this.constructor.__state__.call(this), state)
      },
      __computed__: {
        value: Object.assign(this.constructor.__computed__.call(this), computed)
      }
    });
  }

  updateState(updated) {
    let next = Object.create(this.__init__, {
      __state__: {
        value: Object.assign({}, this.__state__, updated)
      }
    });
    this.__current__ = next;
    return next;
  }

  updateComputed() {
    if (this !== this.__current__) {
      let updateFns = this.constructor.__update__;
      let current = this.__current__;
      this.__current__ = this;

      for (let stateKey in updateFns) {
        let targetState = this[stateKey];
        let currentState = current[stateKey];

        if (currentState !== targetState) {
          updateFns[stateKey].call(this, targetState, currentState, current);
        }
      }
    }
  }

}

exports.default = Immo;

function setupImmo(Subclass) {
  makeImmoStaticProps(Subclass);
  makeImmoAccessors(Subclass);
}

function defineAccessors(obj, keys, getPropsKey, setPropsKey) {
  if (!keys) return;

  for (let key of keys) {
    Object.defineProperty(obj, key, {
      get: getPropsKey(key),
      set: setPropsKey && setPropsKey(key)
    });
  }
}

function makeImmoAccessors(Subclass) {
  let defineImmoAccessors = (getObj, getPropsKey, setPropsKey) => !getObj ? null : defineAccessors(Subclass.prototype, Object.keys(getObj.call(Subclass.prototype)), getPropsKey, setPropsKey);

  defineImmoAccessors(Subclass.__props__, key => function () {
    return this.__props__[key];
  });
  defineImmoAccessors(Subclass.__state__, key => function () {
    return this.__state__[key];
  });
  defineImmoAccessors(Subclass.__computed__, key => function () {
    return this.__computed__[key];
  }, key => function (value) {
    this.__computed__[key] = value;
  });
}

function makeImmoStaticProps(Subclass) {
  let Superclass = Object.getPrototypeOf(Subclass);
  let propObj = {};

  if (Subclass.prototype.__props__) {
    propObj.__props__ = {
      value() {
        return Object.assign(Superclass.__props__.call(this), Subclass.prototype.__props__.call(this));
      }

    };
  }

  if (Subclass.prototype.__state__) {
    propObj.__state__ = {
      value() {
        return Object.assign(Superclass.__state__.call(this), Subclass.prototype.__state__.call(this));
      }

    };
  }

  if (Subclass.prototype.__computed__) {
    propObj.__computed__ = {
      value() {
        return Object.assign(Superclass.__computed__.call(this), Subclass.prototype.__computed__.call(this));
      }

    };
  }

  if (Subclass.prototype.__update__) {
    propObj.__update__ = {
      value: Object.assign({}, Superclass.__update__, Subclass.prototype.__update__())
    };
  }

  Object.defineProperties(Subclass, propObj);
}

},{}],125:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _immy = _interopRequireDefault(require("immy"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class CellFrame {
  constructor(index, entity) {
    this.index = index;
    this.entities = [entity];
  }

  add(entity) {
    this.entities.push(entity);
  }

  hasCollisionWith(line) {
    return this.entities.some(entity => line.collidesWith(entity));
  }

}

function makeCellFrames(index, entity) {
  return new _immy.default.List([new CellFrame(index, entity)]);
}

function addEntityToCellFrames(cellFrames, index, entity) {
  let cellFrame = cellFrames.get(cellFrames.size() - 1);

  if (index === cellFrame.index) {
    cellFrame.add(entity);
    return cellFrames;
  } else {
    return cellFrames.push(new CellFrame(index, entity));
  }
}

class Frame {
  constructor(stateMap = new Map(), grid = new _immy.default.Map(), collisions = new _immy.default.Map(), updates = []) {
    this.stateMap = stateMap;
    this.grid = grid;
    this.collisions = collisions;
    this.updates = updates;
  }

  clone() {
    return new Frame(new Map(this.stateMap), this.grid, this.collisions);
  }

  getIndexOfCollisionInCell(cell, line) {
    if (!this.grid.has(cell)) return;
    let cellFrames = this.grid.get(cell);

    for (let i = 0; i < cellFrames.size(); i++) {
      let cellFrame = cellFrames.get(i);

      if (cellFrame.hasCollisionWith(line)) {
        return cellFrame.index;
      }
    }
  }

  getIndexOfCollisionWithLine(line) {
    let lineCollisions = this.collisions.get(line.id);

    if (lineCollisions) {
      return lineCollisions.get(0);
    }
  }

  updateStateMap(stateUpdate) {
    if (!stateUpdate) return;

    if (stateUpdate instanceof Array) {
      return stateUpdate.forEach(update => this.updateStateMap(update));
    }

    this.updates.push(stateUpdate);

    for (let nextEntity of stateUpdate.updated) {
      this.stateMap.set(nextEntity.id, nextEntity);
    }
  }

  addToGrid(lineGrid, entity, index) {
    let cells = lineGrid.getCellsNearEntity(entity);

    for (let cell of cells) {
      let cellFrames = this.grid.get(cell);

      if (!cellFrames) {
        cellFrames = makeCellFrames(index, entity);
      } else {
        cellFrames = addEntityToCellFrames(cellFrames, index, entity);
      }

      this.grid = this.grid.withKeySetToValue(cell, cellFrames);
    }
  }

  addToCollisions(line, index) {
    let lineCollisions = this.collisions.get(line.id);

    if (!lineCollisions) {
      lineCollisions = new _immy.default.List([index]);
    } else if (lineCollisions.get(lineCollisions.size() - 1) !== index) {
      lineCollisions = lineCollisions.push(index);
    } else {
      return;
    }

    this.collisions = this.collisions.withKeySetToValue(line.id, lineCollisions);
  }

}

exports.default = Frame;

},{"immy":5}],126:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _immy = _interopRequireDefault(require("immy"));

var _immo = _interopRequireWildcard(require("../immo"));

var _Frame = _interopRequireDefault(require("./Frame.js"));

var _StateUpdate = require("./StateUpdate.js");

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// import {abstractClass} from '../abstract-interface.js'
// @setupImmo
// @abstractClass('makeGrid', 'preIterate', 'postIterate')
class LineEngine extends _immo.default {
  __props__() {
    return {
      iterations: 1,
      stepOptions: {}
    };
  }

  __state__() {
    return {
      linesList: new _immy.default.List(),
      initialStateMap: new Map(),
      constraints: new Map()
    };
  }

  __computed__() {
    return {
      linesMap: new Map(),
      frames: [new _Frame.default()],
      // state IDs
      steppables: [],
      collidables: [],
      // constraint IDs
      iterating: [],
      noniterating: [],
      grid: this.makeGrid()
    };
  }

  __update__() {
    return {
      linesList(targetLinesList, currentLinesList) {
        let diff = currentLinesList.compareTo(targetLinesList);
        diff.forEachPrimitive(primOp => {
          let line = primOp.value;

          if (primOp instanceof _immy.default.ListPatches.Add) {
            this._addLine(line);
          } else {
            this._removeLine(line);
          }
        });
      },

      initialStateMap(targetInitState) {
        this.setInitialStates(Array.from(targetInitState.values()));
      },

      constraints(targetConstraints) {
        this.setConstraints(Array.from(targetConstraints.values()));
      }

    };
  }

  makeGrid() {}

  getLastFrameIndex() {
    this.updateComputed();
    return this._getLastFrameIndex();
  }

  getLastFrame() {
    this.updateComputed();
    return this._getLastFrame();
  }

  getStateMapAtFrame(index) {
    this.updateComputed();

    this._computeFrame(index);

    return this.frames[index].stateMap;
  }

  getUpdatesAtFrame(index) {
    this.updateComputed();

    this._computeFrame(index);

    return this.frames[index].updates;
  }

  getLine(id) {
    this.updateComputed();
    return this.linesMap.get(id);
  }

  getMaxLineID() {
    this.updateComputed();
    let length = this.linesList.size();

    if (length === 0) {
      return null;
    }

    return this.linesList.get(length - 1).id;
  }

  addLine(line) {
    this.updateComputed();

    let nextLinesList = this._modifyLinesList(line, (lines, line) => {
      this._addLine(line);

      let index = lines.findInsertionIndexWithBinarySearch(existing => existing.id - line.id);
      return lines.withValueAdded(index, line);
    });

    return this.updateState({
      linesList: nextLinesList
    });
  }

  removeLine(line) {
    this.updateComputed();

    let nextLinesList = this._modifyLinesList(line, (lines, line) => {
      this._removeLine(line);

      let index = lines.findIndexWithBinarySearch(existing => existing.id - line.id);
      return lines.withValueRemoved(index, line);
    });

    return this.updateState({
      linesList: nextLinesList
    });
  } // state: array of {id, collidable, ...}


  setInitialStates(stateArray) {
    this.updateComputed();

    this._setFramesLength(1);

    this.steppables = stateArray.filter(({
      steppable
    }) => steppable).map(({
      id
    }) => id);
    this.collidables = stateArray.filter(({
      collidable
    }) => collidable).map(({
      id
    }) => id);
    let initialStateMap = new Map(stateArray.map(state => [state.id, state]));
    this.frames[0] = new _Frame.default(initialStateMap);
    return this.updateState({
      initialStateMap
    });
  }

  setConstraints(constraints) {
    this.updateComputed();

    this._setFramesLength(1);

    this.iterating = constraints.filter(({
      iterating
    }) => iterating).map(({
      id
    }) => id);
    this.noniterating = constraints.filter(({
      iterating
    }) => !iterating).map(({
      id
    }) => id);
    let constraintsMap = new Map(constraints.map(constraint => [constraint.id, constraint]));
    return this.updateState({
      constraints: constraintsMap
    });
  }

  _addLine(line) {
    this.linesMap.set(line.id, line);
    let cells = this.grid.add(line);

    for (let cell of cells) {
      let index = this._getLastFrame().getIndexOfCollisionInCell(cell, line);

      if (index != null) {
        this._setFramesLength(index);
      }
    }
  }

  _removeLine(line) {
    this.linesMap.delete(line.id);
    this.grid.remove(line);

    let index = this._getLastFrame().getIndexOfCollisionWithLine(line);

    if (index != null) {
      this._setFramesLength(index);
    }
  }

  _modifyLinesList(line, modify) {
    if (line instanceof Array) {
      return line.reduce((lines, line) => modify(lines, line), this.linesList);
    } else {
      return modify(this.linesList, line);
    }
  }

  _setFramesLength(length) {
    this.frames.length = length;
  }

  _getLastFrameIndex() {
    return this.frames.length - 1;
  }

  _getLastFrame() {
    return this.frames[this._getLastFrameIndex()];
  }

  _computeFrame(index) {
    while (this.frames.length <= index) {
      let nextFrame = this._getNextFrame(this._getLastFrame(), this._getLastFrameIndex() + 1);

      this.frames.push(nextFrame);
    }
  } // step -> (resolve <-> collide) -> endResolve


  _getNextFrame(frame, index) {
    frame = frame.clone();

    this._stepStates(frame, this.steppables);

    for (let i = 0; i < this.iterations; i++) {
      this._resolveConstraints(frame, this.iterating);

      this._collideEntities(frame, this.collidables, index);
    }

    this._resolveConstraints(frame, this.noniterating);

    return frame;
  }

  _stepStates(frame, stateIDs) {
    let updatedStates = stateIDs.map(id => frame.stateMap.get(id).step(this.stepOptions));
    frame.updateStateMap(new _StateUpdate.StepUpdate(updatedStates));
  }

  _resolveConstraints(frame, constraintIDs) {
    for (let id of constraintIDs) {
      let constraint = this.constraints.get(id);
      frame.updateStateMap(new _StateUpdate.ConstraintUpdate(constraint.resolve(frame.stateMap), id));
    }
  }

  _collideEntities(frame, stateIDs, index) {
    for (let id of stateIDs) {
      let entity = frame.stateMap.get(id);
      frame.addToGrid(this.grid, entity, index);
      let lines = this.grid.getLinesNearEntity(entity);

      for (let line of lines) {
        let nextEntity = line.collide(entity);

        if (nextEntity) {
          frame.updateStateMap(new _StateUpdate.CollisionUpdate(nextEntity, line.id));
          entity = nextEntity;
          frame.addToGrid(this.grid, entity, index);
          frame.addToCollisions(line, index);
        }
      }
    }
  }

}

exports.default = LineEngine;
(0, _immo.setupImmo)(LineEngine); // abstractClass('makeGrid', 'preIterate', 'postIterate')(LineEngine)

},{"../immo":124,"./Frame.js":125,"./StateUpdate.js":127,"immy":5}],127:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CollisionUpdate = exports.ConstraintUpdate = exports.StepUpdate = exports.default = void 0;

class StateUpdate {
  /**
   * [constructor description]
   * @param  {Array} updated [description]
   * @param  {[type]} id      [description]
   */
  constructor(updated, id) {
    this.updated = updated;

    if (id != null) {
      this.id = id;
    }
  }

  get type() {
    return this.constructor.name;
  }

}

exports.default = StateUpdate;

class StepUpdate extends StateUpdate {}

exports.StepUpdate = StepUpdate;

class ConstraintUpdate extends StateUpdate {}

exports.ConstraintUpdate = ConstraintUpdate;

class CollisionUpdate extends StateUpdate {
  constructor(updated, id) {
    super([updated], id);
  }

}

exports.CollisionUpdate = CollisionUpdate;

},{}],128:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "default", {
  enumerable: true,
  get: function () {
    return _LineEngine.default;
  }
});

var _LineEngine = _interopRequireDefault(require("./LineEngine.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

},{"./LineEngine.js":126}],129:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _immo = require("../immo");

var _lineEngine = _interopRequireDefault(require("../line-engine"));

var _lineSpace = _interopRequireDefault(require("../line-space"));

var _constants = require("./constants.js");

var _Rider = _interopRequireDefault(require("./Rider.js"));

var _grids = require("./grids");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// @setupImmo
class LineRiderEngine extends _lineEngine.default {
  __props__() {
    return {
      iterations: _constants.ITERATE,
      stepOptions: {
        gravity: _constants.GRAVITY
      },
      rider: this.makeRider()
    };
  }

  __state__() {
    return {
      start: {
        position: _constants.DEFAULT_START_POSITION,
        velocity: _constants.DEFAULT_START_VELOCITY
      }
    };
  }

  __computed__() {
    return {
      lineSpace: new _lineSpace.default(({
        p1: {
          x: x1,
          y: y1
        },
        p2: {
          x: x2,
          y: y2
        }
      }) => [x1, y1, x2, y2])
    };
  }
  /* public */
  // getLastFrameIndex ()
  // getLine (id)
  // getMaxLineID ()
  // addLine (line)
  // removeLine (line)


  constructor() {
    super();
    return this.setStart().setConstraints(this.rider.constraints);
  }

  setStart(position = _constants.DEFAULT_START_POSITION, velocity = _constants.DEFAULT_START_VELOCITY) {
    return this.updateState({
      start: {
        position,
        velocity
      }
    }).setInitialStates(this.rider.makeStateArray(position, velocity));
  }

  getRider(frameIndex) {
    return this.rider.getBody(this.getStateMapAtFrame(frameIndex));
  }

  toJSON() {
    // until List.toJS() gets implemented
    this.linesList.__getBuffer();

    return {
      start: this.start,
      lines: this.linesList.buffer.map(line => line.toJSON())
    };
  }
  /* private */


  _addLine(line) {
    super._addLine(line);

    this.lineSpace.addLine(line);
  }

  _removeLine(line) {
    super._removeLine(line);

    this.lineSpace.removeLine(line);
  }

  makeRider() {
    return new _Rider.default();
  }

  makeGrid(...args) {
    return new _grids.ClassicGrid(...args);
  }

  selectLinesInBox(x0, y0, x1, y1) {
    this.updateComputed();
    return this.lineSpace.selectLinesInBox(x0, y0, x1, y1);
  }

  selectLinesInRadius(c, r) {
    this.updateComputed();
    return this.lineSpace.selectLinesInRadius(c, r);
  }

  selectClosestLineInRadius(c, r) {
    this.updateComputed();
    return this.lineSpace.selectClosestLineInRadius(c, r);
  }

  getBoundingBox() {
    this.updateComputed();
    return this.lineSpace.getBoundingBox();
  }

}

exports.default = LineRiderEngine;
(0, _immo.setupImmo)(LineRiderEngine);

},{"../immo":124,"../line-engine":128,"../line-space":145,"./Rider.js":130,"./constants.js":131,"./grids":135}],130:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var States = _interopRequireWildcard(require("./states"));

var Constraints = _interopRequireWildcard(require("./constraints"));

var _v = _interopRequireDefault(require("../v2"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

// import classicRiderBody from './rider-data'
const classicRiderBody = {
  "states": [{
    "id": "RIDER_MOUNTED",
    "type": "Binding"
  }, {
    "id": "SLED_INTACT",
    "type": "Binding"
  }, {
    "id": "PEG",
    "type": "CollisionPoint",
    "x": 0,
    "y": 0,
    "friction": 0.8
  }, {
    "id": "TAIL",
    "type": "CollisionPoint",
    "x": 0,
    "y": 5,
    "friction": 0
  }, {
    "id": "NOSE",
    "type": "CollisionPoint",
    "x": 15,
    "y": 5,
    "friction": 0
  }, {
    "id": "STRING",
    "type": "CollisionPoint",
    "x": 17.5,
    "y": 0,
    "friction": 0
  }, {
    "id": "BUTT",
    "type": "CollisionPoint",
    "x": 5,
    "y": 0,
    "friction": 0.8
  }, {
    "id": "SHOULDER",
    "type": "CollisionPoint",
    "x": 5,
    "y": -5.5,
    "friction": 0.8
  }, {
    "id": "RHAND",
    "type": "CollisionPoint",
    "x": 11.5,
    "y": -5,
    "friction": 0.1
  }, {
    "id": "LHAND",
    "type": "CollisionPoint",
    "x": 11.5,
    "y": -5,
    "friction": 0.1
  }, {
    "id": "LFOOT",
    "type": "CollisionPoint",
    "x": 10,
    "y": 5,
    "friction": 0
  }, {
    "id": "RFOOT",
    "type": "CollisionPoint",
    "x": 10,
    "y": 5,
    "friction": 0
  }, {
    "id": "SCARF_0",
    "type": "FlutterPoint",
    "x": 3,
    "y": -5.5,
    "airFriction": 0.2
  }, {
    "id": "SCARF_1",
    "type": "FlutterPoint",
    "x": 1,
    "y": -5.5,
    "airFriction": 0.2
  }, {
    "id": "SCARF_2",
    "type": "FlutterPoint",
    "x": -1,
    "y": -5.5,
    "airFriction": 0.2
  }, {
    "id": "SCARF_3",
    "type": "FlutterPoint",
    "x": -3,
    "y": -5.5,
    "airFriction": 0.2
  }, {
    "id": "SCARF_4",
    "type": "FlutterPoint",
    "x": -5,
    "y": -5.5,
    "airFriction": 0.2
  }, {
    "id": "SCARF_5",
    "type": "FlutterPoint",
    "x": -7,
    "y": -5.5,
    "airFriction": 0.2
  }, {
    "id": "SCARF_6",
    "type": "FlutterPoint",
    "x": -9,
    "y": -5.5,
    "airFriction": 0.2
  }],
  "constraints": [{
    "id": "PEG_TAIL",
    "type": "Stick",
    "p1": "PEG",
    "p2": "TAIL"
  }, {
    "id": "TAIL_NOSE",
    "type": "Stick",
    "p1": "TAIL",
    "p2": "NOSE"
  }, {
    "id": "NOSE_STRING",
    "type": "Stick",
    "p1": "NOSE",
    "p2": "STRING"
  }, {
    "id": "STRING_PEG",
    "type": "Stick",
    "p1": "STRING",
    "p2": "PEG"
  }, {
    "id": "PEG_NOSE",
    "type": "Stick",
    "p1": "PEG",
    "p2": "NOSE"
  }, {
    "id": "STRING_TAIL",
    "type": "Stick",
    "p1": "STRING",
    "p2": "TAIL"
  }, {
    "id": "PEG_BUTT",
    "type": "BindStick",
    "p1": "PEG",
    "p2": "BUTT",
    "binding": "RIDER_MOUNTED",
    "endurance": 0.057
  }, {
    "id": "TAIL_BUTT",
    "type": "BindStick",
    "p1": "TAIL",
    "p2": "BUTT",
    "binding": "RIDER_MOUNTED",
    "endurance": 0.057
  }, {
    "id": "NOSE_BUTT",
    "type": "BindStick",
    "p1": "NOSE",
    "p2": "BUTT",
    "binding": "RIDER_MOUNTED",
    "endurance": 0.057
  }, {
    "id": "SHOULDER_BUTT",
    "type": "Stick",
    "p1": "SHOULDER",
    "p2": "BUTT"
  }, {
    "id": "SHOULDER_LHAND",
    "type": "Stick",
    "p1": "SHOULDER",
    "p2": "LHAND"
  }, {
    "id": "SHOULDER_RHAND",
    "type": "Stick",
    "p1": "SHOULDER",
    "p2": "RHAND"
  }, {
    "id": "BUTT_LFOOT",
    "type": "Stick",
    "p1": "BUTT",
    "p2": "LFOOT"
  }, {
    "id": "BUTT_RFOOT",
    "type": "Stick",
    "p1": "BUTT",
    "p2": "RFOOT"
  }, {
    "id": "SHOULDER_RHAND_2",
    "type": "Stick",
    "p1": "SHOULDER",
    "p2": "RHAND"
  }, {
    "id": "SHOULDER_PEG",
    "type": "BindStick",
    "p1": "SHOULDER",
    "p2": "PEG",
    "binding": "RIDER_MOUNTED",
    "endurance": 0.057
  }, {
    "id": "STRING_LHAND",
    "type": "BindStick",
    "p1": "STRING",
    "p2": "LHAND",
    "binding": "RIDER_MOUNTED",
    "endurance": 0.057
  }, {
    "id": "STRING_RHAND",
    "type": "BindStick",
    "p1": "STRING",
    "p2": "RHAND",
    "binding": "RIDER_MOUNTED",
    "endurance": 0.057
  }, {
    "id": "LFOOT_NOSE",
    "type": "BindStick",
    "p1": "LFOOT",
    "p2": "NOSE",
    "binding": "RIDER_MOUNTED",
    "endurance": 0.057
  }, {
    "id": "RFOOT_NOSE",
    "type": "BindStick",
    "p1": "RFOOT",
    "p2": "NOSE",
    "binding": "RIDER_MOUNTED",
    "endurance": 0.057
  }, {
    "id": "SHOULDER_LFOOT",
    "type": "RepelStick",
    "p1": "SHOULDER",
    "p2": "LFOOT",
    "lengthFactor": 0.5
  }, {
    "id": "SHOULDER_RFOOT",
    "type": "RepelStick",
    "p1": "SHOULDER",
    "p2": "RFOOT",
    "lengthFactor": 0.5
  }, {
    "id": "BODY_SLED_JOINT",
    "type": "BindJoint",
    "p1": "SHOULDER",
    "p2": "BUTT",
    "q1": "STRING",
    "q2": "PEG",
    "binding": "RIDER_MOUNTED"
  }, {
    "id": "SLED_PEG_JOINT",
    "type": "BindJoint",
    "p1": "PEG",
    "p2": "TAIL",
    "q1": "STRING",
    "q2": "PEG",
    "binding": "SLED_INTACT"
  }, {
    "id": "RIDER_PEG_JOINT",
    "type": "BindJoint",
    "p1": "PEG",
    "p2": "TAIL",
    "q1": "STRING",
    "q2": "PEG",
    "binding": "RIDER_MOUNTED"
  }, {
    "id": "SCARF",
    "type": "DirectedChain",
    "ps": ["SHOULDER", "SCARF_0", "SCARF_1", "SCARF_2", "SCARF_3", "SCARF_4", "SCARF_5", "SCARF_6"]
  }],
  "parts": {
    "SCARF": ["SHOULDER", "SCARF_0", "SCARF_1", "SCARF_2", "SCARF_3", "SCARF_4", "SCARF_5", "SCARF_6"],
    "BODY": ["BUTT", "SHOULDER", "RHAND", "LHAND", "LFOOT", "RFOOT"],
    "SLED": ["PEG", "STRING", "NOSE", "TAIL"],
    "LEFT_ARM": ["SHOULDER", "LHAND"],
    "RIGHT_ARM": ["SHOULDER", "RHAND"],
    "LEFT_LEG": ["BUTT", "LFOOT"],
    "RIGHT_LEG": ["BUTT", "RFOOT"]
  }
};

function createConstraintFromJson(data, initialStateMap) {
  return new Constraints[data.type](data, initialStateMap);
}

function createStateFromJson(data, init) {
  return new States[data.type](data, init);
}

function averageVectors(vecs) {
  return vecs.reduce((avg, v) => avg.add(v), (0, _v.default)({
    x: 0,
    y: 0
  })).div(vecs.length);
}

class Rider {
  constructor(riderBody = classicRiderBody) {
    // TODO: validate riderBody
    this.body = riderBody;
    let initialStateMap = new Map(this.makeStateArray().map(state => [state.id, state]));
    this.constraints = riderBody.constraints.map(data => createConstraintFromJson(data, initialStateMap));
  }

  makeStateArray(position, velocity) {
    return this.body.states.map(stateData => createStateFromJson(stateData, {
      position,
      velocity
    }));
  }

  getBody(stateMap) {
    let points = this.body.parts.BODY.map(id => stateMap.get(id));
    return {
      position: averageVectors(points.map(({
        pos
      }) => pos)),
      velocity: averageVectors(points.map(({
        vel
      }) => vel)),

      get(id) {
        return stateMap.get(id);
      }

    };
  }

}

exports.default = Rider;

},{"../v2":153,"./constraints":132,"./states":143}],131:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.DEFAULT_START_VELOCITY = exports.DEFAULT_START_POSITION = exports.GRAVITY = exports.ITERATE = void 0;
const ITERATE = 6;
exports.ITERATE = ITERATE;
const GRAVITY = {
  x: 0,
  y: 0.175
};
exports.GRAVITY = GRAVITY;
const DEFAULT_START_POSITION = {
  x: 0,
  y: 0
};
exports.DEFAULT_START_POSITION = DEFAULT_START_POSITION;
const DEFAULT_START_VELOCITY = {
  x: 0.4,
  y: 0
};
exports.DEFAULT_START_VELOCITY = DEFAULT_START_VELOCITY;

},{}],132:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.DirectedChain = exports.BindJoint = exports.BindStick = exports.RepelStick = exports.Stick = void 0;

var _v = _interopRequireDefault(require("../../v2"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function stickResolve(p1, p2, diff) {
  let delta = (0, _v.default)(p1.pos).sub(p2.pos).mul(diff);
  return [p1.setPosition((0, _v.default)(p1.pos).sub(delta)), p2.setPosition(delta.add(p2.pos))];
}

function getDiff(restLength, length) {
  return length === 0 ? 0 : (length - restLength) / length;
}

class Stick {
  get iterating() {
    return true;
  }

  constructor({
    id,
    p1,
    p2,
    length,
    lengthFactor = 1
  }, initialStateMap) {
    length = length != null ? length : _v.default.dist(initialStateMap.get(p1).pos, initialStateMap.get(p2).pos);
    length *= lengthFactor;
    Object.assign(this, {
      id,
      p1,
      p2,
      length
    });
  }

  getDiff(length) {
    return getDiff(this.length, length) * 0.5;
  }

  resolve(stateMap) {
    let p1 = stateMap.get(this.p1);
    let p2 = stateMap.get(this.p2);

    let length = _v.default.dist(p1.pos, p2.pos);

    return stickResolve(p1, p2, this.getDiff(length));
  }

}

exports.Stick = Stick;

class RepelStick extends Stick {
  resolve(stateMap) {
    let p1 = stateMap.get(this.p1);
    let p2 = stateMap.get(this.p2);

    let length = _v.default.dist(p1.pos, p2.pos);

    if (length >= this.length) {
      return [];
    }

    return stickResolve(p1, p2, this.getDiff(length));
  }

}

exports.RepelStick = RepelStick;

class BindStick extends Stick {
  constructor({
    id,
    p1,
    p2,
    length,
    binding,
    endurance
  }, initialStateMap) {
    super({
      id,
      p1,
      p2,
      length
    }, initialStateMap);
    endurance = endurance * this.length * 0.5;
    Object.assign(this, {
      binding,
      endurance
    });
  }

  resolve(stateMap) {
    let binding = stateMap.get(this.binding);

    if (!binding.isBinded()) {
      return [];
    }

    let p1 = stateMap.get(this.p1);
    let p2 = stateMap.get(this.p2);

    let length = _v.default.dist(p1.pos, p2.pos);

    let diff = this.getDiff(length);

    if (diff > this.endurance) {
      return [binding.setBind(false)];
    }

    return stickResolve(p1, p2, diff);
  }

}

exports.BindStick = BindStick;

class BindJoint {
  get iterating() {
    return false;
  }

  constructor({
    id,
    p1,
    p2,
    q1,
    q2,
    binding
  }) {
    Object.assign(this, {
      id,
      p1,
      p2,
      q1,
      q2,
      binding
    });
  }

  resolve(stateMap) {
    let p1 = stateMap.get(this.p1);
    let p2 = stateMap.get(this.p2);
    let q1 = stateMap.get(this.q1);
    let q2 = stateMap.get(this.q2);
    let binding = stateMap.get(this.binding); // allow kramuals

    if (_v.default.cross((0, _v.default)(p2.pos).sub(p1.pos), (0, _v.default)(q2.pos).sub(q1.pos)) >= 0) {
      return [];
    } else if (binding.isBinded()) {
      return [binding.setBind(false)];
    }

    return [];
  }

}

exports.BindJoint = BindJoint;

class DirectedChain {
  get iterating() {
    return false;
  }

  constructor({
    id,
    ps
  }, initialStateMap) {
    let [, ...points] = ps;
    let lengths = points.map((id, i) => _v.default.dist(initialStateMap.get(id).pos, initialStateMap.get(ps[i]).pos));
    Object.assign(this, {
      id,
      ps,
      lengths
    });
  }

  resolve(stateMap) {
    let points = this.ps.map(id => stateMap.get(id));

    for (let i = 1; i < points.length; i++) {
      let p0 = points[i - 1];
      let p1 = points[i];
      let restLength = this.lengths[i - 1];

      let length = _v.default.dist(p0.pos, p1.pos);

      let nextPosition = (0, _v.default)(p0.pos).sub(p1.pos).mul(getDiff(restLength, length)).add(p1.pos);
      points[i] = p1.setPosition(nextPosition);
    }

    [, ...points] = points;
    return points;
  }

}

exports.DirectedChain = DirectedChain;

},{"../../v2":153}],133:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _getCellsFromLine = require("./getCellsFromLine.js");

var _hashNumberPair = require("../../utils/hashNumberPair.js");

var _subclassable = require("../../subclassable");

var _orderedObjectArray = _interopRequireDefault(require("../../ordered-object-array"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const GRID_SIZE = 14;

class LineCellsMap extends _subclassable.SubclassableMap {
  add(line, cells) {
    this.set(line.id, cells);
  }

  remove(line) {
    let cells = this.get(line.id);
    if (!cells) return [];
    this.delete(line.id);
    return cells;
  }

}

class CellLinesMap extends _subclassable.SubclassableMap {
  add(line, cells) {
    for (let cell of cells) {
      let cellLines = this.get(cell);

      if (!cellLines) {
        cellLines = new _orderedObjectArray.default('id', true);
        this.set(cell, cellLines);
      }

      cellLines.add(line);
    }
  }

  remove(line, cells) {
    for (let cell of cells) {
      let cellLines = this.get(cell);
      cellLines.remove(line);

      if (cellLines.length === 0) {
        this.delete(cell);
      }
    }
  }

} // handles collidable lines in 6.2 physics


class ClassicGrid {
  constructor(getCellFn = _getCellsFromLine.classicCells) {
    this.getCellsFromLine = getCellFn;
    this.lineCellsMap = new LineCellsMap();
    this.cellLinesMap = new CellLinesMap();
  }

  add(line) {
    if (!line.collidable) return [];
    let cells = this.getCellsFromLine(line, GRID_SIZE);
    this.lineCellsMap.add(line, cells);
    this.cellLinesMap.add(line, cells);
    return cells;
  }

  remove(line) {
    let cells = this.lineCellsMap.remove(line);
    this.cellLinesMap.remove(line, cells);
  } // 3x3 grid around entity


  getCellsNearEntity(entity) {
    let gx = Math.floor(entity.pos.x / GRID_SIZE);
    let gy = Math.floor(entity.pos.y / GRID_SIZE);
    let cells = [];

    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        cells.push((0, _hashNumberPair.hashIntPair)(i + gx, j + gy));
      }
    }

    return cells;
  } // the lines in the 3x3 grid around entity, with duplicates


  getLinesNearEntity(entity) {
    let lines = [];
    let cells = this.getCellsNearEntity(entity);

    for (let cell of cells) {
      let cellLines = this.cellLinesMap.get(cell);
      if (!cellLines) continue;

      for (let line of cellLines) {
        lines.push(line);
      }
    }

    return lines;
  }

}

exports.default = ClassicGrid;

},{"../../ordered-object-array":146,"../../subclassable":149,"../../utils/hashNumberPair.js":152,"./getCellsFromLine.js":134}],134:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ddaCells = ddaCells;
exports.classicCells = classicCells;
exports.legacyCells = legacyCells;

var _hashNumberPair = require("../../utils/hashNumberPair.js");

var _dda = _interopRequireDefault(require("../../utils/dda.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function ddaCells({
  p1,
  p2
}, gridSize) {
  return (0, _dda.default)(p1.x / gridSize, p1.y / gridSize, p2.x / gridSize, p2.y / gridSize).map(({
    x,
    y
  }) => (0, _hashNumberPair.hashIntPair)(x, y));
} // 6.2


function classicCells(line, gridSize) {
  let cellsPos = ClassicCells.getCellsPos(line, gridSize);
  return cellsPos.map(({
    x,
    y
  }) => (0, _hashNumberPair.hashIntPair)(x, y));
} // 6.1


function legacyCells(line, gridSize) {
  return LegacyCells.getCellsPos(line, gridSize).map(({
    x,
    y
  }) => (0, _hashNumberPair.hashIntPair)(x, y));
}

class ClassicCells {
  static getCellsPos(line, gridSize) {
    var cellsPos = [];
    let cellPosStart = getCellPosAndOffset(line.p1.x, line.p1.y, gridSize);
    let cellPosEnd = getCellPosAndOffset(line.p2.x, line.p2.y, gridSize);
    cellsPos.push(cellPosStart);

    if (line.c.vec.x === 0 && line.c.vec.y === 0 || cellPosStart.x === cellPosEnd.x && cellPosStart.y === cellPosEnd.y) {
      return cellsPos; // done
    }

    let box = getBox(cellPosStart.x, cellPosStart.y, cellPosEnd.x, cellPosEnd.y);
    let getNextPos;

    if (line.c.vec.x === 0) {
      getNextPos = (l, x, y, dx, dy) => {
        return {
          x: x,
          y: y + dy
        };
      };
    } else if (line.c.vec.y === 0) {
      getNextPos = (l, x, y, dx, dy) => {
        return {
          x: x + dx,
          y: y
        };
      };
    } else {
      getNextPos = this.getNextPos;
    }

    let cellPos = cellPosStart;
    let pos = {
      x: line.p1.x,
      y: line.p1.y
    };

    while (cellPos != null) {
      let d = this.getDelta(line, cellPos, gridSize);
      let nextPos = getNextPos(line, pos.x, pos.y, d.x, d.y);
      let nextCellPos = getCellPosAndOffset(nextPos.x, nextPos.y, gridSize);

      if (nextCellPos.x === cellPos.x && nextCellPos.y === cellPos.y) {
        // 6.1 grid screws up on rare occasions
        // this would crash the flash version, so it's undefined and we'll just bail
        break;
      }

      if (inBounds(nextCellPos, box)) {
        cellsPos.push(nextCellPos);
        cellPos = nextCellPos;
        pos = nextPos;
      } else {
        cellPos = null;
      }
    }

    return cellsPos;
  }

  static getNextPos(line, x, y, dx, dy) {
    let slope = line.c.vec.y / line.c.vec.x;
    let yNext = y + slope * dx;

    if (Math.abs(yNext - y) < Math.abs(dy)) {
      return {
        x: x + dx,
        y: yNext
      };
    }

    if (Math.abs(yNext - y) === Math.abs(dy)) {
      return {
        x: x + dx,
        y: y + dy
      };
    }

    return {
      x: x + line.c.vec.x * dy / line.c.vec.y,
      y: y + dy
    };
  }

  static getDelta(line, cellPos, gridSize) {
    let dx, dy;

    if (cellPos.x < 0) {
      dx = (gridSize + cellPos.gx) * (line.c.vec.x > 0 ? 1 : -1);
    } else {
      dx = -cellPos.gx + (line.c.vec.x > 0 ? gridSize : -1);
    }

    if (cellPos.y < 0) {
      dy = (gridSize + cellPos.gy) * (line.c.vec.y > 0 ? 1 : -1);
    } else {
      dy = -cellPos.gy + (line.c.vec.y > 0 ? gridSize : -1);
    }

    return {
      x: dx,
      y: dy
    };
  }

}

class LegacyCells extends ClassicCells {
  static getDelta(line, cellPos, gridSize) {
    return {
      x: -cellPos.gx + (line.c.vec.x > 0 ? gridSize : -1),
      y: -cellPos.gy + (line.c.vec.y > 0 ? gridSize : -1)
    };
  }

  static getNextPos(line, x, y, dx, dy) {
    let slope = line.c.vec.y / line.c.vec.x;
    let yIsThisBelowActualY0 = line.p1.y - slope * line.p1.x;
    let yDoesThisEvenWork = Math.round(slope * (x + dx) + yIsThisBelowActualY0);

    if (Math.abs(yDoesThisEvenWork - y) < Math.abs(dy)) {
      return {
        x: x + dx,
        y: yDoesThisEvenWork
      };
    }

    if (Math.abs(yDoesThisEvenWork - y) === Math.abs(dy)) {
      return {
        x: x + dx,
        y: y + dy
      };
    }

    return {
      x: Math.round((y + dy - yIsThisBelowActualY0) / slope),
      y: y + dy
    };
  }

}

function getCellPosAndOffset(px, py, gridSize) {
  let {
    x,
    y
  } = getCellPos(px, py, gridSize);
  return {
    x: x,
    y: y,
    gx: px - gridSize * x,
    gy: py - gridSize * y
  };
}

function getCellPos(x, y, gridSize) {
  return {
    x: getCellCor(x, gridSize),
    y: getCellCor(y, gridSize)
  };
}

function getCellCor(x, gridSize) {
  return Math.floor(x / gridSize);
}

function getBox(x1, y1, x2, y2) {
  let left = Math.min(x1, x2);
  let right = Math.max(x1, x2);
  let top = Math.min(y1, y2);
  let bottom = Math.max(y1, y2);
  return {
    left: left,
    right: right,
    top: top,
    bottom: bottom,
    corners: [[left, top], [left, bottom], [right, top], [right, bottom]].map(c => {
      return {
        x: c[0],
        y: c[1]
      };
    })
  };
}

function inBounds(p, box) {
  return p.x >= box.left && p.x <= box.right && p.y >= box.top && p.y <= box.bottom;
}

},{"../../utils/dda.js":151,"../../utils/hashNumberPair.js":152}],135:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "ClassicGrid", {
  enumerable: true,
  get: function () {
    return _ClassicGrid.default;
  }
});

var _ClassicGrid = _interopRequireDefault(require("./ClassicGrid.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

},{"./ClassicGrid.js":133}],136:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "default", {
  enumerable: true,
  get: function () {
    return _LineRiderEngine.default;
  }
});
Object.defineProperty(exports, "createLineFromJson", {
  enumerable: true,
  get: function () {
    return _lines.createLineFromJson;
  }
});
Object.defineProperty(exports, "LineTypes", {
  enumerable: true,
  get: function () {
    return _lines.LineTypes;
  }
});
exports.CustomLineRiderEngine = void 0;

var _LineRiderEngine = _interopRequireDefault(require("./LineRiderEngine.js"));

var _lines = require("./lines");

var _getCellsFromLine = require("./grids/getCellsFromLine.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class CustomLineRiderEngine {
  constructor({
    legacy
  }) {
    class CustomLineRiderEngine extends _LineRiderEngine.default {
      makeGrid() {
        if (legacy) {
          return super.makeGrid(_getCellsFromLine.legacyCells);
        } else {
          return super.makeGrid();
        }
      }

    }

    return new CustomLineRiderEngine();
  }

}

exports.CustomLineRiderEngine = CustomLineRiderEngine;

},{"./LineRiderEngine.js":129,"./grids/getCellsFromLine.js":134,"./lines":142}],137:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _v = _interopRequireDefault(require("../../v2"));

var _SolidLine = _interopRequireDefault(require("./SolidLine.js"));

var _LineTypes = _interopRequireDefault(require("./LineTypes.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const ACC = 0.1;

class AccLine extends _SolidLine.default {
  constructor(data) {
    super(data);
    this.c.acc = this.acc;
  }

  get type() {
    return _LineTypes.default.ACC;
  }

  get acc() {
    return (0, _v.default)(this.norm).rotCW().mul(ACC * (this.flipped ? -1 : 1));
  }

  doCollide(p, pos, prevPos) {
    prevPos.add(this.c.acc);
    return p.updateState({
      pos,
      prevPos
    });
  }

}

exports.default = AccLine;

},{"../../v2":153,"./LineTypes.js":139,"./SolidLine.js":141}],138:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _v = _interopRequireDefault(require("../../v2"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class Line {
  constructor({
    id,
    x1,
    y1,
    x2,
    y2
  }) {
    this.id = id;
    this.p1 = (0, _v.default)({
      x: x1,
      y: y1
    });
    this.p2 = (0, _v.default)({
      x: x2,
      y: y2
    });
  }

  get collidable() {
    return false;
  }

  get x1() {
    return this.p1.x;
  }

  get y1() {
    return this.p1.y;
  }

  get x2() {
    return this.p2.x;
  }

  get y2() {
    return this.p2.y;
  }

  get vec() {
    return (0, _v.default)(this.p2).sub(this.p1);
  }

  get lengthSq() {
    return this.vec.lenSq();
  }

  get invLengthSq() {
    return 1 / this.lengthSq;
  }

  get length() {
    return Math.sqrt(this.lengthSq);
  }

  get invLength() {
    return 1 / this.length;
  }

  get norm() {
    return (0, _v.default)(this.vec).rotCW().mul(this.invLength * (this.flipped ? -1 : 1));
  }

  equals(line) {
    return this.id === line.id && this.type === line.type && this.p1.equals(line.p1) && this.p2.equals(line.p2);
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      x1: this.p1.x,
      y1: this.p1.y,
      x2: this.p2.x,
      y2: this.p2.y
    };
  }

}

exports.default = Line;

},{"../../v2":153}],139:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _default = {
  SOLID: 0,
  ACC: 1,
  SCENERY: 2
};
exports.default = _default;

},{}],140:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _Line = _interopRequireDefault(require("./Line.js"));

var _LineTypes = _interopRequireDefault(require("./LineTypes.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class SolidLine extends _Line.default {
  constructor(data) {
    super(data);
  }

  get type() {
    return _LineTypes.default.SCENERY;
  }

}

exports.default = SolidLine;

},{"./Line.js":138,"./LineTypes.js":139}],141:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _v = _interopRequireDefault(require("../../v2"));

var _Line = _interopRequireDefault(require("./Line.js"));

var _LineTypes = _interopRequireDefault(require("./LineTypes.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const MAX_FORCE_LENGTH = 10;
const MIN_EXTENSION_RATIO = 0.25;

class SolidLine extends _Line.default {
  constructor(data) {
    super(data);
    this.flipped = data.flipped || false;
    this.leftExtended = data.leftExtended || false;
    this.rightExtended = data.rightExtended || false;
    this.c = this.getComputed();
  }

  collidesWith(p) {
    let offset = this.offset(p);
    return this.shouldCollide(p, this.perpComp(offset), this.linePos(offset));
  }

  collide(p) {
    let offset = this.offset(p);
    let perpComp = this.perpComp(offset);
    let linePos = this.linePos(offset);

    if (this.shouldCollide(p, perpComp, linePos)) {
      let pos = (0, _v.default)(this.c.norm).mul(perpComp).sub(p.pos).mul(-1); // move the previous point closer to reduce inertia and simulate friction
      // retain multiplication order because multiplication is not associative
      // http://www.ecma-international.org/ecma-262/5.1/#sec-11.5.1

      let v = (0, _v.default)(this.c.norm).rotCCW().mul(p.friction).mul(perpComp);

      if (p.prevPos.x >= pos.x) {
        v.x *= -1;
      }

      if (p.prevPos.y < pos.y) {
        v.y *= -1;
      }

      v.add(p.prevPos);
      return this.doCollide(p, pos, v);
    }

    return null;
  }

  get type() {
    return _LineTypes.default.SOLID;
  }

  get collidable() {
    return true;
  }

  get extension() {
    return Math.min(MIN_EXTENSION_RATIO, MAX_FORCE_LENGTH / this.length);
  }

  get leftBound() {
    return this.leftExtended ? -this.extension : 0;
  }

  get rightBound() {
    return this.rightExtended ? 1 + this.extension : 1;
  }

  getComputed() {
    let {
      vec,
      norm,
      invLengthSq,
      length,
      extension,
      leftBound,
      rightBound
    } = this;
    return {
      vec,
      norm,
      invLengthSq,
      length,
      extension,
      leftBound,
      rightBound
    };
  }

  offset(p) {
    return (0, _v.default)(p.pos).sub(this.p1);
  } // perpendicular component


  perpComp(offset) {
    return this.c.norm.dot(offset);
  } // normalized parallel component
  // or closest relative position on the line to the point
  // this is the slowest function
  // so maybe come up with a faster boundary checking algo


  linePos(offset) {
    return this.c.vec.dot(offset) * this.c.invLengthSq;
  }

  shouldCollide(p, perpComp, linePos) {
    let pntDirection = this.c.norm.dot(p.vel);
    let pointMovingIntoLine = pntDirection > 0;
    let pointInForceBounds = perpComp > 0 && perpComp < MAX_FORCE_LENGTH && linePos >= this.c.leftBound && linePos <= this.c.rightBound;
    return pointMovingIntoLine && pointInForceBounds;
  }

  doCollide(p, pos, prevPos) {
    return p.updateState({
      pos,
      prevPos
    });
  }

  equals(line) {
    return super.equals(line) && this.flipped === line.flipped && this.leftExtended === line.leftExtended && this.rightExtended === line.rightExtended;
  }

  toJSON() {
    let {
      flipped,
      leftExtended,
      rightExtended
    } = this;
    return Object.assign(super.toJSON(), {
      flipped,
      leftExtended,
      rightExtended
    });
  }

}

exports.default = SolidLine;

},{"../../v2":153,"./Line.js":138,"./LineTypes.js":139}],142:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createLineFromJson = createLineFromJson;
Object.defineProperty(exports, "LineTypes", {
  enumerable: true,
  get: function () {
    return _LineTypes.default;
  }
});

var _LineTypes = _interopRequireDefault(require("./LineTypes.js"));

var _SolidLine = _interopRequireDefault(require("./SolidLine.js"));

var _AccLine = _interopRequireDefault(require("./AccLine.js"));

var _SceneryLine = _interopRequireDefault(require("./SceneryLine.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const LEFT_EXTENDED = 1;
const RIGHT_EXTENDED = 2;

function createLineFromJson(data) {
  if (data.extended) {
    data.leftExtended = !!(LEFT_EXTENDED & data.extended);
    data.rightExtended = !!(RIGHT_EXTENDED & data.extended);
  }

  switch (data.type) {
    case undefined:
      throw new TypeError(`Line JSON requires type: ${data.toString()}`);

    case _LineTypes.default.SOLID:
      return new _SolidLine.default(data);

    case _LineTypes.default.ACC:
      return new _AccLine.default(data);

    case _LineTypes.default.SCENERY:
      return new _SceneryLine.default(data);

    default:
      console.warn(`Line JSON has unknown type, creating as scenery line: ${data.toString()}`);
    // return new Line(data)
  }
}

},{"./AccLine.js":137,"./LineTypes.js":139,"./SceneryLine.js":140,"./SolidLine.js":141}],143:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Binding = exports.FlutterPoint = exports.CollisionPoint = exports.Point = void 0;

var _immo = _interopRequireWildcard(require("../../immo"));

var _v = _interopRequireDefault(require("../../v2"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

let ZERO_VEC = {
  x: 0,
  y: 0
}; // @setupImmo

class Point extends _immo.default {
  __props__() {
    return {
      id: null,
      friction: 0,
      airFriction: 0,
      collidable: false,
      steppable: true
    };
  }

  __state__() {
    return {
      pos: {
        x: 0,
        y: 0
      },
      prevPos: {
        x: 0,
        y: 0
      },
      vel: {
        x: 0,
        y: 0
      }
    };
  }

  constructor({
    id,
    x,
    y,
    friction = 0,
    airFriction = 0
  }, {
    position = ZERO_VEC,
    velocity = ZERO_VEC
  } = {}) {
    super({
      props: {
        id,
        friction,
        airFriction
      },
      state: {
        pos: (0, _v.default)({
          x,
          y
        }).add(position),
        vel: (0, _v.default)(velocity),
        prevPos: (0, _v.default)({
          x,
          y
        }).add(position).sub(velocity)
      }
    });
  }

  getNextPos(vel) {
    return (0, _v.default)(this.pos).add(vel);
  }

  step({
    gravity
  }) {
    let vel = (0, _v.default)(this.pos).sub(this.prevPos).mul(1 - this.airFriction).add(gravity);
    return this.updateState({
      pos: this.getNextPos(vel),
      prevPos: this.pos,
      vel: vel
    });
  }

  setPosition(pos) {
    return this.updateState({
      pos
    });
  }

}

exports.Point = Point;
(0, _immo.setupImmo)(Point);

class CollisionPoint extends Point {
  __props__() {
    return {
      collidable: true
    };
  }

}

exports.CollisionPoint = CollisionPoint;
(0, _immo.setupImmo)(CollisionPoint); // based on the canonical glsl rand
// returns a psuedorandom number between 0 and 1

const V = {
  x: 12.9898,
  y: 78.233
};
const K = 43758.5453;

function rand(seed) {
  return Math.sin(_v.default.dot(seed, V)) * K % 1;
}

const INTENSITY = 2;
const SPEED_THRESHOLD = 40; // as this gets smaller, the scarf intensifies faster while speed increases

class FlutterPoint extends Point {
  static getFlutter(vel, seed) {
    let speed = Math.pow(_v.default.lenSq(vel), 0.25);
    let randMag = rand(vel);
    let randAng = rand(seed);
    randMag *= INTENSITY * speed * -Math.expm1(-speed / SPEED_THRESHOLD);
    randAng *= 2 * Math.PI;
    return {
      x: randMag * Math.cos(randAng),
      y: randMag * Math.sin(randAng)
    };
  }

  getNextPos(vel) {
    return (0, _v.default)(this.pos).add(vel).add(FlutterPoint.getFlutter(vel, this.pos));
  }

}

exports.FlutterPoint = FlutterPoint;

class Binding extends _immo.default {
  __props__() {
    return {
      id: null,
      collidable: false,
      steppable: true
    };
  }

  __state__() {
    return {
      framesSinceUnbind: -1
    };
  }

  constructor({
    id
  }) {
    super({
      props: {
        id
      }
    });
  }

  isBinded() {
    return this.framesSinceUnbind === -1;
  }

  setBind(bind) {
    if (bind && !this.isBinded()) {
      return this.updateState({
        framesSinceUnbind: -1
      });
    } else if (!bind && this.isBinded()) {
      return this.updateState({
        framesSinceUnbind: 0
      });
    }

    return this;
  }

  step() {
    if (this.isBinded()) {
      return this;
    }

    return this.updateState({
      framesSinceUnbind: this.framesSinceUnbind + 1
    });
  }

}

exports.Binding = Binding;
(0, _immo.setupImmo)(Binding);

},{"../../immo":124,"../../v2":153}],144:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _orderedObjectArray = _interopRequireDefault(require("../ordered-object-array"));

var _g = require("../g2");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class LineSpace {
  constructor(getLineCoordinates) {
    this.getLineCoordinates = getLineCoordinates;
    this.lines = new _orderedObjectArray.default('id');
  }

  addLine(line) {
    this.lines.add(line);
  }

  removeLine(line) {
    this.lines.remove(line);
  }

  selectLinesInBox(x0, y0, x1, y1) {
    return this.lines.filter(line => (0, _g.lineInBox)(...this.getLineCoordinates(line), x0, y0, x1, y1));
  }

  selectLinesInRadius({
    x,
    y
  }, r) {
    return this.lines.filter(line => (0, _g.pointLineDistanceSquared)(x, y, ...this.getLineCoordinates(line)) < r * r);
  }

  selectClosestLineInRadius({
    x,
    y
  }, r) {
    let closestLine = null;
    let closestLineDistanceSquared = r * r;

    for (let line of this.lines) {
      let lineDistanceSquared = (0, _g.pointLineDistanceSquared)(x, y, ...this.getLineCoordinates(line));

      if (lineDistanceSquared < closestLineDistanceSquared) {
        closestLine = line;
        closestLineDistanceSquared = lineDistanceSquared;
      }
    }

    return closestLine;
  }

  getBoundingBox() {
    if (this.lines.length === 0) {
      return [0, 0, 0, 0];
    } // left top right bottom


    let bb = [Number.MAX_VALUE, Number.MAX_VALUE, Number.MIN_VALUE, Number.MIN_VALUE];

    const setNextBoundingBox = (x, y) => {
      if (x < bb[0]) {
        bb[0] = x;
      }

      if (y < bb[1]) {
        bb[1] = y;
      }

      if (x > bb[2]) {
        bb[2] = x;
      }

      if (y > bb[3]) {
        bb[3] = y;
      }
    };

    for (let line of this.lines) {
      let [x0, y0, x1, y1] = this.getLineCoordinates(line);
      setNextBoundingBox(x0, y0);
      setNextBoundingBox(x1, y1);
    }

    return bb;
  }

}

exports.default = LineSpace;

},{"../g2":123,"../ordered-object-array":146}],145:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "default", {
  enumerable: true,
  get: function () {
    return _LineSpace.default;
  }
});

var _LineSpace = _interopRequireDefault(require("./LineSpace.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

},{"./LineSpace.js":144}],146:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _sortedIndexBy = _interopRequireDefault(require("lodash/sortedIndexBy.js"));

var _subclassable = require("../subclassable");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class OrderedObjectArray extends _subclassable.SubclassableArray {
  constructor(key, descending = false) {
    super();
    this._key = key;
    this._getID = descending ? obj => -obj[this._key] : obj => obj[this._key];
    this._set = new Set();
  }

  getIndexOf(obj) {
    return (0, _sortedIndexBy.default)(this.toArray(), obj, this._getID);
  }

  has(obj) {
    return this._set.has(obj[this._key]);
  }

  add(obj) {
    if (!this.has(obj)) {
      this._set.add(obj[this._key]);

      let index = this.getIndexOf(obj);
      this.splice(index, 0, obj);
    }
  }

  remove(obj) {
    if (this.has(obj)) {
      this._set.delete(obj[this._key]);

      let index = this.getIndexOf(obj);
      this.splice(index, 1);
    }
  }

}

exports.default = OrderedObjectArray;

},{"../subclassable":149,"lodash/sortedIndexBy.js":118}],147:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _assignPrototype = _interopRequireDefault(require("./assignPrototype.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class SubclassableArray {
  constructor(...args) {
    this.__array__ = new Array(...args);
  }

  toArray() {
    return this.__array__;
  }

  get(i) {
    return this.__array__[i];
  }

  set(i, v) {
    this.__array__[i] = v;
  }

  get length() {
    return this.__array__.length;
  }

  [Symbol.iterator]() {
    return this.__array__[Symbol.iterator]();
  }

}

(0, _assignPrototype.default)(Array, SubclassableArray, '__array__');

const ARRAY_SUBCLASSABLE = (() => {
  class C extends Array {}

  var c = new C();
  return c.concat(1) instanceof C;
})();

var _default = ARRAY_SUBCLASSABLE ? class extends Array {
  toArray() {
    return this;
  }

  get(i) {
    return this[i];
  }

  set(i, v) {
    this[i] = v;
  }

} : SubclassableArray;

exports.default = _default;

},{"./assignPrototype.js":148}],148:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = assignPrototype;

function assignPrototype(Class, Subclassable, key) {
  Object.getOwnPropertyNames(Class.prototype).forEach(k => {
    let d = Object.getOwnPropertyDescriptor(Class.prototype, k);

    if (k !== 'constructor' && d.value instanceof Function) {
      Object.defineProperty(Subclassable.prototype, k, Object.assign({}, d, {
        value: function (...args) {
          return d.value.call(this[key], ...args);
        }
      }));
    }
  });
}

},{}],149:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "SubclassableArray", {
  enumerable: true,
  get: function () {
    return _array.default;
  }
});
Object.defineProperty(exports, "SubclassableMap", {
  enumerable: true,
  get: function () {
    return _map.default;
  }
});

var _array = _interopRequireDefault(require("./array.js"));

var _map = _interopRequireDefault(require("./map.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

},{"./array.js":147,"./map.js":150}],150:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _assignPrototype = _interopRequireDefault(require("./assignPrototype.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class SubclassableMap {
  constructor(...args) {
    this.__map__ = new Map(...args);
  }

  get size() {
    return this.__map__.size;
  }

}

(0, _assignPrototype.default)(Map, SubclassableMap, '__map__');

const MAP_SUBCLASSABLE = (() => {
  var key = {};

  class M extends Map {}

  try {
    var map = new M();
    map.set(key, 123);
  } catch (e) {
    return false;
  }

  return map instanceof M && map.has(key) && map.get(key) === 123;
})();

var _default = MAP_SUBCLASSABLE ? Map : SubclassableMap;

exports.default = _default;

},{"./assignPrototype.js":148}],151:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = dda;

// digital differential analyzer
function dda(x0, y0, x1, y1) {
  if (x0 > x1) {
    return dda(x1, y1, x0, y0);
  }

  const slope = (y1 - y0) / (x1 - x0);

  if (Math.abs(slope) > 1) {
    return dda(y0, x0, y1, x1).map(({
      x,
      y
    }) => ({
      x: y,
      y: x
    }));
  }

  const cx0 = Math.floor(x0);
  const cy0 = Math.floor(y0);
  const cx1 = Math.floor(x1);
  const cy1 = Math.floor(y1);
  let out = [{
    x: cx0,
    y: cy0
  }];
  let prevY = cy0;

  for (let x = cx0 + 1; x <= cx1; x++) {
    const y = Math.floor(y1 + slope * (x - x1));

    if (y !== prevY) {
      out.push({
        x: x - 1,
        y
      });
      prevY = y;
    }

    out.push({
      x,
      y
    });
  }

  if (cy1 !== prevY) {
    out.push({
      x: cx1,
      y: cy1
    });
  }

  return out;
}

},{}],152:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.hashUIntPair = hashUIntPair;
exports.unhashUIntPair = unhashUIntPair;
exports.hashIntPair = hashIntPair;
exports.unhashIntPair = unhashIntPair;

// http://stackoverflow.com/a/13871379
function hashUIntPair(a, b) {
  return a >= b ? a * a + a + b : b * b + a;
}

function unhashUIntPair(n) {
  let x = Math.sqrt(n) | 0; // x = a < b ? b : a

  let r = n - x * x; //        r = a < b ? a : a+b

  if (r < x) {
    // r = a, x = b, a < b
    return [r, x];
  } else {
    // r = a+b, x = a
    return [x, r - x];
  }
}

function hashIntPair(a, b) {
  let A = a >= 0 ? 2 * a : -2 * a - 1;
  let B = b >= 0 ? 2 * b : -2 * b - 1;
  let C = A >= B ? A * A + A + B : B * B + A;
  return C & 1 ? -(C - 1) / 2 - 1 : C / 2;
}

function unhashIntPair(n) {
  let C = n >= 0 ? n * 2 : -(n + 1) * 2 + 1;
  let [A, B] = unhashUIntPair(C);
  let a = A & 1 ? -(A + 1) / 2 : A / 2;
  let b = B & 1 ? -(B + 1) / 2 : B / 2;
  return [a, b];
}

},{}],153:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.len = len;
exports.lenSq = lenSq;
exports.angle = angle;
exports.angleTo = angleTo;
exports.dist = dist;
exports.distSq = distSq;
exports.dot = dot;
exports.cross = cross;
exports.equals = equals;
exports.default = void 0;

/**
 * @typedef Vec2
 *
 * @property {number} x - X component
 * @property {number} y - Y component
 */
function len(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

function lenSq(v) {
  return v.x * v.x + v.y * v.y;
}

function angle(v) {
  return Math.atan2(v.y, v.x);
}

function angleTo(v, u) {
  return angle(u) - angle(v);
}

function dist(v, u) {
  const dx = u.x - v.x;
  const dy = u.y - v.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function distSq(v, u) {
  const dx = u.x - v.x;
  const dy = u.y - v.y;
  return dx * dx + dy * dy;
}

function dot(v, u) {
  return v.x * u.x + v.y * u.y;
}

function cross(v, u) {
  return v.x * u.y - v.y * u.x;
}

function equals(v, u) {
  return v.x === u.x && v.y === u.y;
}

const V2Functions = {
  len,
  lenSq,
  angle,
  angleTo,
  dist,
  distSq,
  dot,
  cross,
  equals
};
const V2Methods = {
  /* mutating methods */
  add(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  },

  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  },

  mul(s) {
    this.x *= s;
    this.y *= s;
    return this;
  },

  div(s) {
    this.x /= s;
    this.y /= s;
    return this;
  },

  norm() {
    this.div(this.len());
    return this;
  },

  // X axis →
  // Y axis ↓
  // rotates clockwise
  rot(rads) {
    const cos = Math.cos(rads);
    const sin = Math.sin(rads);
    const x = this.x;
    const y = this.y;
    this.x = x * cos - y * sin;
    this.y = x * sin + y * cos;
    return this;
  },

  rotCW() {
    const x = this.x;
    const y = this.y;
    this.x = -y;
    this.y = x;
    return this;
  },

  rotCCW() {
    const x = this.x;
    const y = this.y;
    this.x = y;
    this.y = -x;
    return this;
  }

};

for (let key in V2Functions) {
  let fn = V2Functions[key];

  V2Methods[key] = function (v) {
    return fn(this, v);
  };
}

function V2(v) {
  let u = Object.create(V2Methods);
  u.x = v.x;
  u.y = v.y;
  return u;
}

Object.assign(V2, V2Functions);
var _default = V2;
exports.default = _default;

},{}]},{},[122]);
