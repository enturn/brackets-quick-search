/*
 * Copyright (c) 2012 Adobe Systems Incorporated. All rights reserved.
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

/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, doReplace, brackets */
/*unittests: FindReplace*/


/*
 * Adds Find and Replace commands
 *
 * Originally based on the code in CodeMirror2/lib/util/search.js.
 */
define(function (require, exports, module) {
    "use strict";

    var CommandManager      = brackets.getModule("command/CommandManager"),
        Commands            = brackets.getModule("command/Commands"),
        Strings             = brackets.getModule("strings"),
        Editor              = brackets.getModule("editor/Editor"),
        EditorManager       = brackets.getModule("editor/EditorManager");
    
    var isFindFirst = false;
    
    function SearchState() {
        this.posFrom = this.posTo = this.query = null;
        this.marked = [];
    }

    function getSearchState(cm) {
        // NOTE: this integrates with the builtin search.
        if (!cm._searchState) {
            cm._searchState = new SearchState();
        }
        return cm._searchState;
    }

    function getSearchCursor(cm, query, pos) {
        // Heuristic: if the query string is all lowercase, do a case insensitive search.
        return cm.getSearchCursor(query, pos, typeof query === "string" && query === query.toLowerCase());
    }

    function parseQuery(query) {
        var isRE = query.match(/^\/(.*)\/([a-z]*)$/);
        //$(".modal-bar .message").css("display", "inline-block");
        //$(".modal-bar .error").css("display", "none");
        try {
            if (isRE && isRE[1]) {  // non-empty regexp
                return new RegExp(isRE[1], isRE[2].indexOf("i") === -1 ? "" : "i");
            } else {
                return query;
            }
        } catch (e) {
            //$(".modal-bar .message").css("display", "none");
            //$(".modal-bar .error")
            //    .css("display", "inline-block")
            //    .html("<div class='alert-message' style='margin-bottom: 0'>" + e.message + "</div>");
            return "";
        }
    }

    function findNext(editor, rev) {
        var cm = editor._codeMirror;
        var found = true;
        cm.operation(function () {
            var state = getSearchState(cm);
            var cursor = getSearchCursor(cm, state.query, rev ? state.posFrom : state.posTo);

            if (!cursor.find(rev)) {
                // If no result found before hitting edge of file, try wrapping around
                cursor = getSearchCursor(cm, state.query, rev ? {line: cm.lineCount() - 1} : {line: 0, ch: 0});
                
                // No result found, period: clear selection & bail
                if (!cursor.find(rev)) {
                    cm.setCursor(cm.getCursor());  // collapses selection, keeping cursor in place to avoid scrolling
                    found = false;
                    return;
                }
            }

            var centerOptions = (isFindFirst) ? Editor.BOUNDARY_IGNORE_TOP : Editor.BOUNDARY_CHECK_NORMAL;
            editor.setSelection(cursor.from(), cursor.to(), true, centerOptions);
            state.posFrom = cursor.from();
            state.posTo = cursor.to();
            state.findNextCalled = true;
        });
        return found;
    }

    function clearHighlights(state) {
        state.marked.forEach(function (markedRange) {
            markedRange.clear();
        });
        state.marked.length = 0;
    }

    function clearSearch(cm) {
        cm.operation(function () {
            var state = getSearchState(cm);
            if (!state.query) {
                return;
            }
            state.query = null;

            clearHighlights(state);
        });
    }
    
    function clear(editor) {
        var cm = editor._codeMirror;
        var state = getSearchState(cm);
        clearSearch(cm);
        //clearHighlights(state);
        
        // As soon as focus goes back to the editor, restore normal selection color
        $(cm.getWrapperElement()).removeClass("find-highlighting");
    }


    /**
     * If no search pending, opens the search dialog. If search is already open, moves to
     * next/prev result (depending on 'rev')
     */
    function doSearch(editor, rev, initialQuery) {
        var cm = editor._codeMirror;
        var state = getSearchState(cm);
        if (state.query) {
            //findNext(editor, rev);
            return;
        }
        
        // Use the selection start as the searchStartPos. This way if you
        // start with a pre-populated search and enter an additional character,
        // it will extend the initial selection instead of jumping to the next
        // occurrence.
        var searchStartPos = cm.getCursor(true);
        
        // Called each time the search query changes while being typed. Jumps to the first matching
        // result, starting from the original cursor position
        function findFirst(query) {
            isFindFirst = true;
            cm.operation(function () {
                if (state.query) {
                    clearHighlights(getSearchState(cm));
                }
                state.query = parseQuery(query);
                if (!state.query) {
                    cm.setCursor(searchStartPos);
                    return;
                }
                
                // Highlight all matches
                // (Except on huge documents, where this is too expensive)
                if (cm.getValue().length < 500000) {
                    // Temporarily change selection color to improve highlighting - see LESS code for details
                    $(cm.getWrapperElement()).addClass("find-highlighting");
                    
                    // FUTURE: if last query was prefix of this one, could optimize by filtering existing result set
                    var cursor = getSearchCursor(cm, state.query);
                    while (cursor.findNext()) {
                        state.marked.push(cm.markText(cursor.from(), cursor.to(), { className: "CodeMirror-searching" }));

                        //Remove this section when https://github.com/marijnh/CodeMirror/issues/1155 will be fixed
                        if (cursor.pos.match && cursor.pos.match[0] === "") {
                            if (cursor.to().line + 1 === cm.lineCount()) {
                                break;
                            }
                            cursor = getSearchCursor(cm, state.query, {line: cursor.to().line + 1, ch: 0});
                        }
                    }
                }
                
                state.posFrom = state.posTo = searchStartPos;
                //NOTE: this was causing the cursor to move to the end of the search word
                //var foundAny = findNext(editor, rev);
            });
            isFindFirst = false;
        }

        // Prepopulate the search field with the current selection, if any.
        if (initialQuery !== undefined) {
            findFirst(initialQuery);
            // Clear the "findNextCalled" flag here so we have a clean start
            state.findNextCalled = false;
        }
    }

    
    /*function _findNext() {
        var editor = EditorManager.getActiveEditor();
        if (editor) {
            doSearch(editor);
        }
    }

    function _findPrevious() {
        var editor = EditorManager.getActiveEditor();
        if (editor) {
            doSearch(editor, true);
        }
    }*/
    
    exports.doSearch = doSearch;
    exports.clear = clear;
    
    //CommandManager.register(Strings.CMD_FIND_NEXT,      Commands.EDIT_FIND_NEXT,     _findNext);
    //CommandManager.register(Strings.CMD_FIND_PREVIOUS,  Commands.EDIT_FIND_PREVIOUS, _findPrevious);
});
