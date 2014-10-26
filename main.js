// Author: Nathan Turner
// I used brackets-automatch-pairs-master extension as starting code.
// I'm not sure how much is considered substantial so I'll leave the below notice untouched. I adopt the same license.

/*
* Copyright (c) 2013 Zaidin Amiot. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a
* copy of this software and associated documentation files (the "Software"),
* to deal in the Software without restriction, including without limitation
* the rights to use, copy, modify, merge, publish, distribute, sublicense,
* and/or sell copies of the Software, and to permit persons to whom the
* Software is furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in
* all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
* FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
* DEALINGS IN THE SOFTWARE.
*
*/

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

define(function (require, exports, module) {
    'use strict';
    
    // Brackets modules.
    var CommandManager      = brackets.getModule("command/CommandManager"),
        EditorManager       = brackets.getModule("editor/EditorManager"),
        Menus               = brackets.getModule("command/Menus"),
        Commands            = brackets.getModule("command/Commands"),
        Strings             = brackets.getModule("strings"),
        FindReplace         = brackets.getModule("search/FindReplace"),
        FindBar,
        
    // Extension variables.
        QUICKSEARCH         = 'quicksearch.toggle',
        _find               = require('find'),
        _enabled            = true,
        _previouslySearched = false,
        _previousQuery      = "";

    if (parseFloat(brackets.metadata.apiVersion) >= 0.41) {
        FindBar = brackets.getModule("search/FindBar").FindBar;
    }

    // Extension functions.
    
    // similar to Editor.prototype.selectWordAt 
    function isWordSelected(line, selectedText, selection) {
        var start = selection.start.ch, //Start is inclusive, end is exclusive.
            end = selection.end.ch;

        function isWordChar(ch) {
            return (/\w|[$]/).test(ch) || ch.toUpperCase() !== ch.toLowerCase();
        }
        
        // check the beginning and end of the selectedText are word chars
        if (!isWordChar(selectedText.charAt(0))
                || !isWordChar(selectedText.charAt(selectedText.length - 1))) {
            return false;
        }
        
        // check the surrounding chars are not word chars
        var startBoundary = (start === 0 || !isWordChar(line.charAt(start - 1)));
        var endBoundary = (end === line.length || !isWordChar(line.charAt(end)));
        
        return startBoundary && endBoundary;
    }
    
    function escapeRegexpChars(selectedText) {
        //http://stackoverflow.com/questions/3115150/how-to-escape-regular-expression-special-characters-using-javascript
        return selectedText.replace(/[\-\[\]{}()*+?.,\\$\^|#\s]/g, "\\$&");
    }
    
    function _handler(event, editor) {
    
        if (editor && !_previouslySearched) {
            
            if (editor.hasSelection()) {
                var selectedText = editor.getSelectedText();
                if (selectedText.toLowerCase() === _previousQuery) {
                    return; // let internal search do the findNext
                } else {
                    _previousQuery = selectedText.toLowerCase();
                }

                //NOTE: move to inside isWordSelected condition if using the builtin search state
                // clear any previous searches
                _find.clear(editor);
                
                // don't allow multiple lines to be searched for
                if (selectedText.indexOf('\n') !== -1) {
                    return;
                }

                var selection = editor.getSelection();
                var line = editor.document.getLine(selection.start.line);
                
                if (isWordSelected(line, selectedText, selection)) {
                    // make sure certain characters are escaped for the regexp
                    var rawText = selectedText;
                    selectedText = escapeRegexpChars(selectedText);
                    
                    // the boundary characters make sure only the whole word is searched
                    var regexp = '/\\b' + selectedText + '\\b/i';
                    var selectedStartsWith = selectedText.slice(0, 2);
                    if (selectedStartsWith === '\\$') {
                        regexp = '/' + selectedText + '\\b/i';
                    }
                    _find.updateBuiltinSearchState(editor, regexp);
                    _find.doSearch(editor, false, regexp, rawText);
                }
            } else {
                if (_previousQuery !== "") {
                    _previousQuery = "";
                    _find.clear(editor);
                }
            }
        }
        
        // only do the quick search if starting from no selection
        if (editor && !editor.hasSelection()) {
            _previouslySearched = false;
        }
    }
    
    // a hack to get the highlighting to work a bit better,
    // previously a change in the find dialog would remove highlighting,
    // then another change would bring it back, same for ScrollTrackMarkers.
    // This makes sure when the find bar is opened the search is only done by
    // the internal search.
    function DummyFindBar() {}
    DummyFindBar.prototype.close = function () {
        var editor = EditorManager.getActiveEditor();
        // active editor is null when no open files
        if (editor) {
            _find.clear(editor);
            _previouslySearched = true;
        }
    };
    // the other FindBar functions in case they're needed
    DummyFindBar.prototype.isClosed = function () { return true; };
    DummyFindBar.prototype.open = function () { };
    DummyFindBar.prototype.getOptions = function () { return {}; };
    DummyFindBar.prototype.getQueryInfo = function () {
        return {
            query: _previousQuery || "",
            isCaseSensitive: false,
            isRegexp: true
        };
    };
    DummyFindBar.prototype.showError = function (error, isHTML) { };
    DummyFindBar.prototype.showFindCount = function (count) { };
    DummyFindBar.prototype.showNoResults = function (showIndicator, showMessage) { };
    DummyFindBar.prototype.getReplaceText = function () { return ""; };
    DummyFindBar.prototype.enable = function (enable) { };
    DummyFindBar.prototype.isEnabled = function () { return false; };
    DummyFindBar.prototype.isReplaceEnabled = function () { return false; };
    DummyFindBar.prototype.enableNavigation = function (enable) { };
    DummyFindBar.prototype.enableReplace = function (enable) { };
    DummyFindBar.prototype.focusQuery = function () { };
    DummyFindBar.prototype.focusReplace = function () { };
    

    if (parseFloat(brackets.metadata.apiVersion) < 0.41) {
        try {
            FindReplace._registerFindInFilesCloser(function () {
                new DummyFindBar().close();
            });
        } catch (e) {
            console.warn("FindReplace._registerFindInFilesCloser() no longer exists");
        }
    } else if (parseFloat(brackets.metadata.apiVersion) >= 0.41) {
        FindBar._addFindBar(new DummyFindBar());
    }

    function _handlerOff(editor) {
        _find.clear(editor);
        $(editor).off('cursorActivity', _handler);
    }
    
    function _disableHandler(editor) {
        $(editor).off('cursorActivity', _handler);
    }
    
    function _handlerOn(editor) {
        $(editor).on('cursorActivity', _handler);
    }
    
    // Toggle the extension, set the _document and register the listener.
    function _toggle() {
        _enabled = !_enabled;
        
        // Set the new state for the menu item.
        CommandManager.get(QUICKSEARCH).setChecked(_enabled);
        
        var editor = EditorManager.getActiveEditor();
        
        // Register or remove listener depending on _enabled.
        if (_enabled) {
            _handlerOn(editor);
        } else {
            _handlerOff(editor);
        }
    }
    
    // Reset the listeners when the active editor change.
    $(EditorManager).on("activeEditorChange",
        function (event, current, previous) {
            if (_enabled) {
                if (previous) {
                    _handlerOff(previous);
                }
                if (current) {
                    _handlerOn(current);
                }
            }
        });

    // Register command.
    CommandManager.register("Enable Quick Search", QUICKSEARCH, _toggle);

    // Add command to View menu.
    Menus.getMenu(Menus.AppMenuBar.VIEW_MENU).addMenuItem(QUICKSEARCH);

    // Set the starting state for the menu item.
    CommandManager.get(QUICKSEARCH).setChecked(_enabled);
});