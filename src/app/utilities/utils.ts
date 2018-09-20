import { NODE_TYPE, TIMESTAMP_ATTR } from './variables';

export const dom = function(el?) {
  return /** @lends dom **/ {
    /**
     * Adds class to element.
     * @param {string} className
     */
    addClass: function(className) {
      if (el.classList) {
        el.classList.add(className);
      } else {
        el.className += ' ' + className;
      }
    },

    /**
     * Removes class from element.
     * @param {string} className
     */
    removeClass: function(className) {
      if (el.classList) {
        el.classList.remove(className);
      } else {
        el.className = el.className.replace(
          new RegExp('(^|\\b)' + className + '(\\b|$)', 'gi'),
          ' '
        );
      }
    },

    /**
     * Prepends child nodes to base element.
     * @param {Node[]} nodesToPrepend
     */
    prepend: function(nodesToPrepend) {
      var nodes = Array.prototype.slice.call(nodesToPrepend),
        i = nodes.length;

      while (i--) {
        el.insertBefore(nodes[i], el.firstChild);
      }
    },

    /**
     * Appends child nodes to base element.
     * @param {Node[]} nodesToAppend
     */
    append: function(nodesToAppend) {
      var nodes = Array.prototype.slice.call(nodesToAppend);

      for (var i = 0, len = nodes.length; i < len; ++i) {
        el.appendChild(nodes[i]);
      }
    },

    /**
     * Inserts base element after refEl.
     * @param {Node} refEl - node after which base element will be inserted
     * @returns {Node} - inserted element
     */
    insertAfter: function(refEl) {
      return refEl.parentNode.insertBefore(el, refEl.nextSibling);
    },

    /**
     * Inserts base element before refEl.
     * @param {Node} refEl - node before which base element will be inserted
     * @returns {Node} - inserted element
     */
    insertBefore: function(refEl) {
      return refEl.parentNode.insertBefore(el, refEl);
    },

    /**
     * Removes base element from DOM.
     */
    remove: function() {
      el.parentNode.removeChild(el);
      el = null;
    },

    /**
     * Returns true if base element contains given child.
     * @param {Node|HTMLElement} child
     * @returns {boolean}
     */
    contains: function(child) {
      return el !== child && el.contains(child);
    },

    /**
     * Wraps base element in wrapper element.
     * @param {HTMLElement} wrapper
     * @returns {HTMLElement} wrapper element
     */
    wrap: function(wrapper) {
      if (el.parentNode) {
        el.parentNode.insertBefore(wrapper, el);
      }

      wrapper.appendChild(el);
      return wrapper;
    },

    /**
     * Unwraps base element.
     * @returns {Node[]} - child nodes of unwrapped element.
     */
    unwrap: function() {
      var nodes = Array.prototype.slice.call(el.childNodes),
        wrapper;

      nodes.forEach(function(node) {
        wrapper = node.parentNode;
        dom(node).insertBefore(node.parentNode);
        dom(wrapper).remove();
      });

      return nodes;
    },

    /**
     * Returns array of base element parents.
     * @returns {HTMLElement[]}
     */
    parents: function() {
      var parent,
        path = [];

      while (!!(parent = el.parentNode)) {
        path.push(parent);
        el = parent;
      }

      return path;
    },

    /**
     * Normalizes text nodes within base element, ie. merges sibling text nodes and assures that every
     * element node has only one text node.
     * It should does the same as standard element.normalize, but IE implements it incorrectly.
     */
    normalizeTextNodes: function() {
      if (!el) {
        return;
      }

      if (el.nodeType === NODE_TYPE.TEXT_NODE) {
        while (el.nextSibling && el.nextSibling.nodeType === NODE_TYPE.TEXT_NODE) {
          el.nodeValue += el.nextSibling.nodeValue;
          el.parentNode.removeChild(el.nextSibling);
        }
      } else {
        dom(el.firstChild).normalizeTextNodes();
      }
      dom(el.nextSibling).normalizeTextNodes();
    },

    /**
     * Returns element background color.
     * @returns {CSSStyleDeclaration.backgroundColor}
     */
    color: function() {
      return el.style.backgroundColor;
    },

    /**
     * Creates dom element from given html string.
     * @param {string} html
     * @returns {NodeList}
     */
    fromHTML: function(html) {
      var div = document.createElement('div');
      div.innerHTML = html;
      return div.childNodes;
    },

    /**
     * Returns first range of the window of base element.
     * @returns {Range}
     */
    getRange: function() {
      var selection = dom(el).getSelection(),
        range;

      if (selection.rangeCount > 0) {
        range = selection.getRangeAt(0);
      }

      return range;
    },

    /**
     * Removes all ranges of the window of base element.
     */
    removeAllRanges: function() {
      var selection = dom(el).getSelection();
      selection.removeAllRanges();
    },

    /**
     * Returns selection object of the window of base element.
     * @returns {Selection}
     */
    getSelection: function() {
      return dom(el)
        .getWindow()
        .getSelection();
    },

    /**
     * Returns window of the base element.
     * @returns {Window}
     */
    getWindow: function() {
      return dom(el).getDocument().defaultView;
    },

    /**
     * Returns document of the base element.
     * @returns {HTMLDocument}
     */
    getDocument: function() {
      // if ownerDocument is null then el is the document itself.
      return el.ownerDocument || el;
    }
  };
};

/**
 * Returns true if elements a i b have the same color.
 * @param {Node} a
 * @param {Node} b
 * @returns {boolean}
 */
export const haveSameColor = function(a, b) {
  return dom(a).color() === dom(b).color();
};

/**
 * Fills undefined values in obj with default properties with the same name from source object.
 * @param {object} obj - target object
 * @param {object} source - source object with default values
 * @returns {object}
 */
export const defaults = function(obj, source) {
  obj = obj || {};

  for (var prop in source) {
    if (source.hasOwnProperty(prop) && obj[prop] === void 0) {
      obj[prop] = source[prop];
    }
  }

  return obj;
};

/**
 * Returns array without duplicated values.
 * @param {Array} arr
 * @returns {Array}
 */
export const unique = function(arr) {
  return arr.filter(function(value, idx, self) {
    return self.indexOf(value) === idx;
  });
};

/**
 * Takes range object as parameter and refines it boundaries
 * @param range
 * @returns {object} refined boundaries and initial state of highlighting algorithm.
 */
export const refineRangeBoundaries = function(range) {
  var startContainer = range.startContainer,
    endContainer = range.endContainer,
    ancestor = range.commonAncestorContainer,
    goDeeper = true;

  if (range.endOffset === 0) {
    while (!endContainer.previousSibling && endContainer.parentNode !== ancestor) {
      endContainer = endContainer.parentNode;
    }
    endContainer = endContainer.previousSibling;
  } else if (endContainer.nodeType === NODE_TYPE.TEXT_NODE) {
    if (range.endOffset < endContainer.nodeValue.length) {
      endContainer.splitText(range.endOffset);
    }
  } else if (range.endOffset > 0) {
    endContainer = endContainer.childNodes.item(range.endOffset - 1);
  }

  if (startContainer.nodeType === NODE_TYPE.TEXT_NODE) {
    if (range.startOffset === startContainer.nodeValue.length) {
      goDeeper = false;
    } else if (range.startOffset > 0) {
      startContainer = startContainer.splitText(range.startOffset);
      if (endContainer === startContainer.previousSibling) {
        endContainer = startContainer;
      }
    }
  } else if (range.startOffset < startContainer.childNodes.length) {
    startContainer = startContainer.childNodes.item(range.startOffset);
  } else {
    startContainer = startContainer.nextSibling;
  }

  return {
    startContainer: startContainer,
    endContainer: endContainer,
    goDeeper: goDeeper
  };
};

/**
 * Sorts array of DOM elements by its depth in DOM tree.
 * @param {HTMLElement[]} arr - array to sort.
 * @param {boolean} descending - order of sort.
 */
export const sortByDepth = function(arr, descending) {
  arr.sort(function(a, b) {
    return (
      dom(descending ? b : a).parents().length - dom(descending ? a : b).parents().length
    );
  });
};

/**
 * Groups given highlights by timestamp.
 * @param {Array} highlights
 * @returns {Array} Grouped highlights.
 */
export const groupHighlights = function(highlights) {
  var order = [],
    chunks = {},
    grouped = [];

  highlights.forEach(function(hl) {
    var timestamp = hl.getAttribute(TIMESTAMP_ATTR);

    if (typeof chunks[timestamp] === 'undefined') {
      chunks[timestamp] = [];
      order.push(timestamp);
    }

    chunks[timestamp].push(hl);
  });

  order.forEach(function(timestamp) {
    var group = chunks[timestamp];

    grouped.push({
      chunks: group,
      timestamp: timestamp,
      toString: function() {
        return group
          .map(function(h) {
            return h.textContent;
          })
          .join('');
      }
    });
  });

  return grouped;
};
