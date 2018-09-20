import { Directive, OnInit, OnDestroy, ElementRef, Renderer2 } from '@angular/core';
import {
  dom,
  sortByDepth,
  groupHighlights,
  defaults,
  haveSameColor,
  unique,
  refineRangeBoundaries
} from '../utilities/utils';
import {
  NODE_TYPE,
  DATA_ATTR,
  IGNORE_TAGS,
  TIMESTAMP_ATTR
} from '../utilities/variables';

@Directive({
  selector: '[textHighlighter]'
})
export class TexthighlighterDirective implements OnInit, OnDestroy {
  el;
  touchStartListener;
  mouseUpListener;
  options = defaults(
    {},
    {
      color: '#ffff7b',
      highlightedClass: 'highlighted',
      contextClass: 'highlighter-context',
      onRemoveHighlight: function() {
        return true;
      },
      onBeforeHighlight: function() {
        return true;
      },
      onAfterHighlight: function() {}
    }
  );

  constructor(private element: ElementRef, private renderer: Renderer2) {}

  ngOnInit() {
    this.el = this.element.nativeElement;
    this.mouseUpListener = this.renderer.listen('document', 'mouseup', e => {
      this.highlightHandler(e);
    });

    this.touchStartListener = this.renderer.listen('document', 'touchstart', e => {
      this.highlightHandler(e);
    });
  }

  ngOnDestroy() {
    this.mouseUpListener();
    this.touchStartListener();
    dom(this.el).removeClass(this.options.contextClass);
  }

  highlightHandler = function(e) {
    if (window.getSelection().toString() !== '') {
      this.doHighlight();
    }
  };

  /**
   * Highlights current range.
   * @param {boolean} keepRange - Don't remove range after highlighting. Default: false.
   * @memberof TextHighlighter
   */
  doHighlight = function(keepRange) {
    var range = dom(this.el).getRange(),
      wrapper,
      createdHighlights,
      normalizedHighlights,
      timestamp;

    if (!range || range.collapsed) {
      return;
    }

    if (this.options.onBeforeHighlight(range) === true) {
      timestamp = +new Date();
      wrapper = this.createWrapper(this.options);
      wrapper.setAttribute(TIMESTAMP_ATTR, timestamp);

      createdHighlights = this.highlightRange(range, wrapper);
      normalizedHighlights = this.normalizeHighlights(createdHighlights);

      this.options.onAfterHighlight(range, normalizedHighlights, timestamp);

      keepRange = keepRange || this.options.keepRange;
      if (!keepRange) {
        dom(this.el).removeAllRanges();
      }
    }
  };

  /**
   * Highlights range.
   * Wraps text of given range object in wrapper element.
   * @param {Range} range
   * @param {HTMLElement} wrapper
   * @returns {Array} - array of created highlights.
   * @memberof TextHighlighter
   */
  highlightRange = function(range, wrapper) {
    if (!range || range.collapsed) {
      return [];
    }

    var result = refineRangeBoundaries(range),
      startContainer = result.startContainer,
      endContainer = result.endContainer,
      goDeeper = result.goDeeper,
      done = false,
      node = startContainer,
      highlights = [],
      highlight,
      wrapperClone,
      nodeParent;

    do {
      if (goDeeper && node.nodeType === NODE_TYPE.TEXT_NODE) {
        if (
          IGNORE_TAGS.indexOf(node.parentNode.tagName) === -1 &&
          node.nodeValue.trim() !== ''
        ) {
          wrapperClone = wrapper.cloneNode(true);
          wrapperClone.setAttribute(DATA_ATTR, true);
          nodeParent = node.parentNode;

          // highlight if a node is inside the el
          if (dom(this.el).contains(nodeParent) || nodeParent === this.el) {
            highlight = dom(node).wrap(wrapperClone);
            highlights.push(highlight);
          }
        }

        goDeeper = false;
      }
      if (node === endContainer && !(endContainer.hasChildNodes() && goDeeper)) {
        done = true;
      }

      if (node.tagName && IGNORE_TAGS.indexOf(node.tagName) > -1) {
        if (endContainer.parentNode === node) {
          done = true;
        }
        goDeeper = false;
      }
      if (goDeeper && node.hasChildNodes()) {
        node = node.firstChild;
      } else if (node.nextSibling) {
        node = node.nextSibling;
        goDeeper = true;
      } else {
        node = node.parentNode;
        goDeeper = false;
      }
    } while (!done);

    return highlights;
  };

  /**
   * Normalizes highlights. Ensures that highlighting is done with use of the smallest possible number of
   * wrapping HTML elements.
   * Flattens highlights structure and merges sibling highlights. Normalizes text nodes within highlights.
   * @param {Array} highlights - highlights to normalize.
   * @returns {Array} - array of normalized highlights. Order and number of returned highlights may be different than
   * input highlights.
   * @memberof TextHighlighter
   */
  normalizeHighlights = function(highlights) {
    var normalizedHighlights;

    this.flattenNestedHighlights(highlights);
    this.mergeSiblingHighlights(highlights);

    // omit removed nodes
    normalizedHighlights = highlights.filter(function(hl) {
      return hl.parentElement ? hl : null;
    });

    normalizedHighlights = unique(normalizedHighlights);
    normalizedHighlights.sort(function(a, b) {
      return a.offsetTop - b.offsetTop || a.offsetLeft - b.offsetLeft;
    });

    return normalizedHighlights;
  };

  /**
   * Flattens highlights structure.
   * Note: this method changes input highlights - their order and number after calling this method may change.
   * @param {Array} highlights - highlights to flatten.
   * @memberof TextHighlighter
   */
  flattenNestedHighlights = function(highlights) {
    var again,
      self = this;

    sortByDepth(highlights, true);

    function flattenOnce() {
      var again = false;

      highlights.forEach(function(hl, i) {
        var parent = hl.parentElement,
          parentPrev = parent.previousSibling,
          parentNext = parent.nextSibling;

        if (self.isHighlight(parent)) {
          if (!haveSameColor(parent, hl)) {
            if (!hl.nextSibling) {
              dom(hl).insertBefore(parentNext || parent);
              again = true;
            }

            if (!hl.previousSibling) {
              dom(hl).insertAfter(parentPrev || parent);
              again = true;
            }

            if (!parent.hasChildNodes()) {
              dom(parent).remove();
            }
          } else {
            parent.replaceChild(hl.firstChild, hl);
            highlights[i] = parent;
            again = true;
          }
        }
      });

      return again;
    }

    do {
      again = flattenOnce();
    } while (again);
  };

  /**
   * Merges sibling highlights and normalizes descendant text nodes.
   * Note: this method changes input highlights - their order and number after calling this method may change.
   * @param highlights
   * @memberof TextHighlighter
   */
  mergeSiblingHighlights = function(highlights) {
    var self = this;

    function shouldMerge(current, node) {
      return (
        node &&
        node.nodeType === NODE_TYPE.ELEMENT_NODE &&
        haveSameColor(current, node) &&
        self.isHighlight(node)
      );
    }

    highlights.forEach(function(highlight) {
      var prev = highlight.previousSibling,
        next = highlight.nextSibling;

      if (shouldMerge(highlight, prev)) {
        dom(highlight).prepend(prev.childNodes);
        dom(prev).remove();
      }
      if (shouldMerge(highlight, next)) {
        dom(highlight).append(next.childNodes);
        dom(next).remove();
      }

      dom(highlight).normalizeTextNodes();
    });
  };

  /**
   * Sets highlighting color.
   * @param {string} color - valid CSS color.
   * @memberof TextHighlighter
   */
  setColor = function(color) {
    this.options.color = color;
  };

  /**
   * Returns highlighting color.
   * @returns {string}
   * @memberof TextHighlighter
   */
  getColor = function() {
    return this.options.color;
  };

  /**
   * Removes highlights from element. If element is a highlight itself, it is removed as well.
   * If no element is given, all highlights all removed.
   * @param {HTMLElement} [element] - element to remove highlights from
   * @memberof TextHighlighter
   */
  removeHighlights = function(element) {
    var container = element || this.el,
      highlights = this.getHighlights({ container: container }),
      self = this;

    function mergeSiblingTextNodes(textNode) {
      var prev = textNode.previousSibling,
        next = textNode.nextSibling;

      if (prev && prev.nodeType === NODE_TYPE.TEXT_NODE) {
        textNode.nodeValue = prev.nodeValue + textNode.nodeValue;
        dom(prev).remove();
      }
      if (next && next.nodeType === NODE_TYPE.TEXT_NODE) {
        textNode.nodeValue = textNode.nodeValue + next.nodeValue;
        dom(next).remove();
      }
    }

    function removeHighlight(highlight) {
      var textNodes = dom(highlight).unwrap();

      textNodes.forEach(function(node) {
        mergeSiblingTextNodes(node);
      });
    }

    sortByDepth(highlights, true);

    highlights.forEach(function(hl) {
      if (self.options.onRemoveHighlight(hl) === true) {
        removeHighlight(hl);
      }
    });
  };

  /**
   * Returns highlights from given container.
   * @param params
   * @param {HTMLElement} [params.container] - return highlights from this element. Default: the element the
   * highlighter is applied to.
   * @param {boolean} [params.andSelf] - if set to true and container is a highlight itself, add container to
   * returned results. Default: true.
   * @param {boolean} [params.grouped] - if set to true, highlights are grouped in logical groups of highlights added
   * in the same moment. Each group is an object which has got array of highlights, 'toString' method and 'timestamp'
   * property. Default: false.
   * @returns {Array} - array of highlights.
   * @memberof TextHighlighter
   */
  getHighlights = function(params) {
    params = defaults(params, {
      container: this.el,
      andSelf: true,
      grouped: false
    });

    var nodeList = params.container.querySelectorAll('[' + DATA_ATTR + ']'),
      highlights = Array.prototype.slice.call(nodeList);

    if (params.andSelf === true && params.container.hasAttribute(DATA_ATTR)) {
      highlights.push(params.container);
    }

    if (params.grouped) {
      highlights = groupHighlights(highlights);
    }

    return highlights;
  };

  /**
   * Returns true if element is a highlight.
   * All highlights have 'data-highlighted' attribute.
   * @param el - element to check.
   * @returns {boolean}
   * @memberof TextHighlighter
   */
  isHighlight = function(el) {
    return el && el.nodeType === NODE_TYPE.ELEMENT_NODE && el.hasAttribute(DATA_ATTR);
  };

  /**
   * Serializes all highlights in the element the highlighter is applied to.
   * @returns {string} - stringified JSON with highlights definition
   * @memberof TextHighlighter
   */
  serializeHighlights = function() {
    var highlights = this.getHighlights(),
      refEl = this.el,
      hlDescriptors = [];

    function getElementPath(el, refElement) {
      var path = [],
        childNodes;

      do {
        childNodes = Array.prototype.slice.call(el.parentNode.childNodes);
        path.unshift(childNodes.indexOf(el));
        el = el.parentNode;
      } while (el !== refElement || !el);

      return path;
    }

    sortByDepth(highlights, false);

    highlights.forEach(function(highlight) {
      var offset = 0, // Hl offset from previous sibling within parent node.
        length = highlight.textContent.length,
        hlPath = getElementPath(highlight, refEl),
        wrapper = highlight.cloneNode(true);

      wrapper.innerHTML = '';
      wrapper = wrapper.outerHTML;

      if (
        highlight.previousSibling &&
        highlight.previousSibling.nodeType === NODE_TYPE.TEXT_NODE
      ) {
        offset = highlight.previousSibling.length;
      }

      hlDescriptors.push([
        wrapper,
        highlight.textContent,
        hlPath.join(':'),
        offset,
        length
      ]);
    });

    return JSON.stringify(hlDescriptors);
  };

  /**
   * Deserializes highlights.
   * @throws exception when can't parse JSON or JSON has invalid structure.
   * @param {object} json - JSON object with highlights definition.
   * @returns {Array} - array of deserialized highlights.
   * @memberof TextHighlighter
   */
  deserializeHighlights = function(json) {
    var hlDescriptors,
      highlights = [],
      self = this;

    if (!json) {
      return highlights;
    }

    try {
      hlDescriptors = JSON.parse(json);
    } catch (e) {
      throw "Can't parse JSON: " + e;
    }

    function deserializationFn(hlDescriptor) {
      var hl = {
          wrapper: hlDescriptor[0],
          text: hlDescriptor[1],
          path: hlDescriptor[2].split(':'),
          offset: hlDescriptor[3],
          length: hlDescriptor[4]
        },
        elIndex = hl.path.pop(),
        node = self.el,
        hlNode,
        highlight,
        idx;

      while (!!(idx = hl.path.shift())) {
        node = node.childNodes[idx];
      }

      if (
        node.childNodes[elIndex - 1] &&
        node.childNodes[elIndex - 1].nodeType === NODE_TYPE.TEXT_NODE
      ) {
        elIndex -= 1;
      }

      node = node.childNodes[elIndex];
      hlNode = node.splitText(hl.offset);
      hlNode.splitText(hl.length);

      if (hlNode.nextSibling && !hlNode.nextSibling.nodeValue) {
        dom(hlNode.nextSibling).remove();
      }

      if (hlNode.previousSibling && !hlNode.previousSibling.nodeValue) {
        dom(hlNode.previousSibling).remove();
      }

      highlight = dom(hlNode).wrap(dom().fromHTML(hl.wrapper)[0]);
      highlights.push(highlight);
    }

    hlDescriptors.forEach(function(hlDescriptor) {
      try {
        deserializationFn(hlDescriptor);
      } catch (e) {
        if (console && console.warn) {
          console.warn("Can't deserialize highlight descriptor. Cause: " + e);
        }
      }
    });

    return highlights;
  };

  /**
   * Finds and highlights given text.
   * @param {string} text - text to search for
   * @param {boolean} [caseSensitive] - if set to true, performs case sensitive search (default: true)
   * @memberof TextHighlighter
   */
  find = function(text, caseSensitive) {
    var wnd = dom(this.el).getWindow(),
      scrollX = wnd.scrollX,
      scrollY = wnd.scrollY,
      caseSens = typeof caseSensitive === 'undefined' ? true : caseSensitive;

    dom(this.el).removeAllRanges();

    if (wnd.find) {
      while (wnd.find(text, caseSens)) {
        this.doHighlight(true);
      }
    } else if (wnd.document.body.createTextRange) {
      var textRange = wnd.document.body.createTextRange();
      textRange.moveToElementText(this.el);
      while (textRange.findText(text, 1, caseSens ? 4 : 0)) {
        if (
          !dom(this.el).contains(textRange.parentElement()) &&
          textRange.parentElement() !== this.el
        ) {
          break;
        }

        textRange.select();
        this.doHighlight(true);
        textRange.collapse(false);
      }
    }

    dom(this.el).removeAllRanges();
    wnd.scrollTo(scrollX, scrollY);
  };

  /**
   * Creates wrapper for highlights.
   * TextHighlighter instance calls this method each time it needs to create highlights and pass options retrieved
   * in constructor.
   * @param {object} options - the same object as in TextHighlighter constructor.
   * @returns {HTMLElement}
   * @memberof TextHighlighter
   * @static
   */
  createWrapper = function(options) {
    var span = document.createElement('span');
    span.style.backgroundColor = options.color;
    span.className = options.highlightedClass;
    return span;
  };
}
