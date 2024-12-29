"use strict";

// ----------------------------------------------------------------
// UTILITIES

// TODO:
// * assertor for non-null (e.g. get-element-by-id)

function isInteger(text) {
  // TODO: this accepts '3.4' and should not
  return !isNaN(parseInt(text))
}

// ----------------------------------------------------------------
// WIDGET CLASSES

class BaseElement {
  constructor() {
  }

  makeVisible() {
    this.underlying.style.display = "block"
    //this.underlying.style.display = "inline"
  }

  makeInvisible() {
    this.underlying.style.display = "none"
  }

  focus() {
    this.underlying.focus()
  }
}

class GenericElement extends BaseElement {
  constructor(
    elementID,
  ) {
    super()
    this.underlying = document.getElementById(elementID)
  }
}

class Slider extends BaseElement {
  constructor(
    sliderElementID,
    labelElementID,
    isUncheckedLabel,
    isCheckedLabel,
    toUncheckedCallback,
    toCheckedCallback,
  ) {
    super()

    // Browser-model element by composition
    // * Underlying unchecked = slider left = light mode
    // * Underlying checked   = slider left = dark  mode
    this.underlyingSlider = document.getElementById(sliderElementID)
    this.underlyingLabel  = document.getElementById(labelElementID)
    // This lets underlying-level callbacks invoke our methods
    this.underlyingSlider.parent = this

    this.isUncheckedLabel    = isUncheckedLabel
    this.isCheckedLabel      = isCheckedLabel
    this.toUncheckedCallback = toUncheckedCallback
    this.toCheckedCallback   = toCheckedCallback

    this.underlyingSlider.addEventListener("change", function(e) {
      let obj = this.parent // Map from browser-level up to class-level
      if (this.checked) { // Here, this is the underlying, and this.checked is the new state
        obj.toChecked(e)
      } else {
        obj.toUnchecked(e)
      }
    })
  }

  // Set the browser-level elements we control
  toUnchecked(e) {
    this.toUncheckedCallback(e)
    this.underlyingLabel.textContent = this.isUncheckedLabel
    this.underlyingSlider.checked = false
  }
  toChecked(e) {
    this.toCheckedCallback(e)
    this.underlyingLabel.textContent = this.isCheckedLabel
    this.underlyingSlider.checked = true
  }
}

class PersistentSlider extends Slider {
  // Uses local storage to remember the state of the slider

  constructor(
    sliderElementID,
    labelElementID,
    isUncheckedLabel,
    isCheckedLabel,
    toUncheckedCallback,
    toCheckedCallback,
  ) {

    super(
      sliderElementID,
      labelElementID,
      isUncheckedLabel,
      isCheckedLabel,
      toUncheckedCallback,
      toCheckedCallback,
    )

    this.localStorageKey = document.URL + ":" + sliderElementID + ":checked"

    // Restore previous state upon construction
    if (localStorage.getItem(this.localStorageKey) == "true") {
      this.toChecked(null)
    } else {
      this.toUnchecked(null)
    }
  }

  // Remember last-set state
  toUnchecked(e) {
    super.toUnchecked(e)
    localStorage.setItem(this.localStorageKey, "false")
  }
  toChecked(e) {
    super.toChecked(e)
    localStorage.setItem(this.localStorageKey, "true")
  }
}

class LightDarkModeSlider extends PersistentSlider {
  // Lightly decorates PersistentSlider by adding labels
  constructor(sliderElementID, labelElementID, lightenCallback, darkenCallback) {
    super(
      sliderElementID,
      labelElementID,
      "Switch to dark mode",
      "Switch to light mode",
      lightenCallback,
      darkenCallback,
    )
  }
}

class Button extends BaseElement {
  constructor(
    elementID,
    text,
    callback,
  ) {
    super()

    // Browser-model element by composition
    this.underlying = document.getElementById(elementID)
    // This lets underlying-level callbacks invoke our methods
    this.underlying.parent = this
    this.callback = callback

    this.underlying.textContent = text

    this.underlying.addEventListener("click", function(event) {
      let obj = this.parent // Map from browser-level up to class-level
      obj.callback(event)
    })
  }

  setTextContent(text) {
    this.underlying.textContent = text
  }
}

class TextInput extends BaseElement {
  // Single-line input element
  constructor(elementID, callback) {
    super()

    // Browser-model element by composition
    this.underlying = document.getElementById(elementID)

    // This lets underlying-level callbacks invoke our methods
    this.underlying.parent = this
    this.callback = callback

    this.underlying.addEventListener("input", function(event) {
      let obj = this.parent // Map from browser-level up to class-level
      this.value = this.value.toUpperCase() // TODO: parameterize upper-casing or not
      obj.callback(event)
    })
  }
  set(text) {
    this.underlying.value = text.toUpperCase() // TODO: parameterize upper-casing or not
  }
  get(text) {
    return this.underlying.value
  }
}

class TextSpan extends BaseElement {
  // This is write-only
  constructor(elementID, initialText) {
    super()

    // Browser-model element by composition
    this.underlying = document.getElementById(elementID)
    this.underlying.textContent = initialText
  }
  set(text) {
    this.underlying.textContent = text
  }
}

class IntRangeInput extends BaseElement {
  // Int-selector with min/max caps, and protection against non-numeric user input
  constructor(elementID, defaultValue, minAllowable, maxAllowable, callback) {
    super()

    this.defaultValue = defaultValue
    // Min/max values for this widget:
    this.minAllowable = minAllowable
    this.maxAllowable = maxAllowable
    // Another IntRangeInput we're coupled to:
    this.peerMin = null
    this.peerMax = null

    // Browser-model element by composition
    this.underlying = document.getElementById(elementID)
    this.underlying.value = this.defaultValue

    // This lets underlying-level callbacks invoke our methods
    this.underlying.parent = this
    this.callback = callback

    this.underlying.addEventListener("change", function(event) {
      let obj = this.parent // Map from browser-level up to class-level

      // The up-and-down sliders won't let the user choose outside the widget's min/max.
      // But the user can still type "999" or "aaa" into the widget. Here we protect against this.
      if (!isInteger(event.target.value)) {
        obj.underlying.value = obj.defaultValue
      } else {
        let requestedValue = Number(event.target.value)

        // Check self-bounds
        if (requestedValue < obj.minAllowable) {
          obj.underlying.value = obj.minAllowable
        } else if (requestedValue > obj.maxAllowable) {
          obj.underlying.value = obj.maxAllowable

        // Check peer-bounds
        } else if (obj.peerMin != null && requestedValue < obj.peerMin.get()) {
          obj.underlying.value = obj.peerMin.get()
        } else if (obj.peerMax != null && requestedValue > obj.peerMax.get()) {
          obj.underlying.value = obj.peerMax.get()
        }
      }

      obj.callback(event)
    })
  }

  setPeerMin(peer) {
    this.peerMin = peer
  }

  setPeerMax(peer) {
    this.peerMax = peer
  }

  resetToDefault() {
    this.underlying.value = this.defaultValue
  }

  get() {
    return Number(this.underlying.value)
  }
}

class Dropdown extends BaseElement {
  constructor(elementID, callback) {
    super()

    // Browser-model element by composition
    this.underlying = document.getElementById(elementID)

    // This lets underlying-level callbacks invoke our methods
    this.underlying.parent = this
    this.callback = callback

    this.underlying.addEventListener("change", function(event) {
      let obj = this.parent // Map from browser-level up to class-level
      obj.callback(event)
    })
  }

  get() {
    return this.underlying.value
  }
}

class TwoElementSwitcher {
  // A single button, controlling which of two elements are visible
  constructor(
    buttonElementID,
    item1, // TODO: assert extends BaseElement
    item2, // TODO: assert extends BaseElement
    item1ShownButtonText,
    item2ShownButtonText,
  ) {
    this.button = new Button(buttonElementID, item1ShownButtonText, this.onClick)
    this.button.parent = this
    this.item1  = item1
    this.item2  = item2
    this.item1ShownButtonText = item1ShownButtonText
    this.item2ShownButtonText = item2ShownButtonText
    this.show1()
  }

  show1() {
    this.whichShown = 1
    this.item1.makeVisible()
    this.item2.makeInvisible()
    this.button.setTextContent(this.item1ShownButtonText)
  }

  show2() {
    this.whichShown = 2
    this.item1.makeInvisible()
    this.item2.makeVisible()
    this.button.setTextContent(this.item2ShownButtonText)
  }

  onClick(event) {
    // "this" is the Button; need to parent up to get the TwoElementSwitcher
    let obj = this.parent
    if (obj.whichShown == 1) {
      obj.show2()
    } else {
      obj.show1()
    }
  }
}
