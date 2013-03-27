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

    // Extension variables.
        QUICKSEARCH         = 'quicksearch.toggle',
        _find               = require('find'),
        _enabled            = true,
        _previousQuery      = "";
    

    // Extension functions.
     
    function isWordSelected(line, selectedText, selection) {
        var start = selection.start.ch, //Start is inclusive, end is exclusive.
            end = selection.end.ch;
        
        function isWordChar(ch) {
            return (/\w/).test(ch) || ch.toUpperCase() !== ch.toLowerCase();
        }
        
        /*
        // check the selectedText is all word chars
        for (var i = 0; i < selectedText.length; ++i) {
            if (!isWordChar(selectedText.charAt(i))) {
                return false;
            }
        }
        */
        
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
    
    // modified from Editor.prototype.selectWordAt 
    function getWordAt(line, pos) {
        var start = pos.ch,
            end = pos.ch;
        
        function isWordChar(ch) {
            return (/\w/).test(ch) || ch.toUpperCase() !== ch.toLowerCase();
        }
        
        while (start > 0 && isWordChar(line.charAt(start - 1))) {
            --start;
        }
        while (end < line.length && isWordChar(line.charAt(end))) {
            ++end;
        }
        
        return line.slice(start, end);
    }
    
    function _handler(event, editor) {
    
        if (editor) {
            
            if (editor.hasSelection()) {
                var selectedText = editor.getSelectedText();
                if (selectedText.toLowerCase() === _previousQuery) {
                    return; // let internal search do the findNext
                } else {
                    _previousQuery = selectedText.toLowerCase();
                }

                // clear any previous searches
                _find.clear(editor);

                var selection = editor.getSelection();
                var line = editor.document.getLine(selection.start.line);
                
                if (isWordSelected(line, selectedText, selection)) {
                    _find.doSearch(editor, false, editor.getSelectedText());
                }
            } else {
                _previousQuery = "";
                _find.clear(editor);
                /*
                // For searching on every word near the cursor
                //TODO fix issues of when typing
                //TODO shouldn't override the selection highlighting
                var word = getWordAt(line, pos);
                _find.doSearch(editor, false, word);
                */
            }
        }
    }
    
    function _handlerOff(editor) {
        _find.clear(editor);
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