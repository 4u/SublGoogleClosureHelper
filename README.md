What is it?
===========

It's snippet maker for JS (Google Closure Library). This plugin makes function definitions easilly.

How to use
==========

1. Write command in special syntax
2. Press shortcut
3. Profit

Clone
=====

`cd ~/Library/Application\ Support/Sublime\ Text\ 2/Packages/`
`git clone https://github.com/4u/SublGoogleClosureHelper.git`

Make key binding
================

Goto Preferences -> Key Bindings (User), add line:
`{ "keys": ["ctrl+shift+a"], "command": "gct_createmethod" }`

Syntax
======

Function
--------

`[type] [methodName]([paramType1] [paramName1], [paramType2] [paramName2]) : [return]`

For example:
<pre><code>goog.provide('example.MyClass');
...
protected getElementById(string id) : Element
</code></pre>

Returns:
<pre><code>/**
 * @param {string} id
 * @protected
 * @return {Element}
 */
example.MyClass.prototype.getElementById = function(id) {
  
};
</code></pre>
For constructors [methodName] have to be full (with namespace). Return is inerpretated as extends


Property
--------

`[type] [properyType] [propertyName] [= [value]]`

Example:
<pre><code>goog.provide('example.MyClass');
...
private number _id = 0
</code></pre>

Returns:
<pre><code>/**
 * @type {number}
 * @private
 */
example.MyClass.prototype._id = 0;
</code></pre>

Keywords
--------

+ constructor | ctor
+ singleton | ston | single
+ static
+ private
+ protected
+ override
+ inheritDoc | inherit
+ enum | dict
+ define
+ public

For mixed types you can use `number=` or `!number` or `number?` or `number|string`.
Also, you can use aliases for primitives, but it doesn't work in complicated types. 
