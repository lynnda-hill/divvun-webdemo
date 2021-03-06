// -*- indent-tabs-mode: nil; tab-width: 2; js2-basic-offset: 2; coding: utf-8 -*-
/* global $, history, console, repl, external */

/**
 * TODO:
 * - Add an 'errorclass'-parameter to the list of errors/API? (for highlighting colours)
 * - Make «ignore» function actually work (localStorage?)
 * - Prettier
 */

(function(){
  "use strict";

  /* :: type reps = Array<string> */
  /* :: type errlist = Array<[string, number, number, string, string, Array<string>]> */
  /* :: type result = {text: string, errs: errlist}                   */
  /* :: type cb = (X:result) => void */

  var debug = window.location.protocol === "file:";
  var log = debug ? console.log.bind(window.console) : function() {};

  var port/*:number*/ = 8081;
  var hostname/*:string*/ = window.location.hostname === "" ? "localhost" : window.location.hostname;
  var protocol/*:string*/ = window.location.protocol === "file:" ? "http:" : window.location.protocol;
  var checkUrl/*:string*/ = protocol+"//"+hostname+":"+(port.toString())+"/check";
  log(checkUrl);

  var basicAuthHeader = function () {
    // If we stored a previously successful auth *and* password is
    // unset, first try that:
    var prev = window.localStorage["auth"];
    if($("#password").val()==="" && prev != undefined) {
      return prev;
    }
    else {
      var userpass = $("#username").val() + ":" + $("#password").val();
      return "Basic " + btoa(userpass);
    }
  };

  var servercheck = function(plaintext/*:string*/,
                             cb/*:cb*/
                            )/*:void*/ {
    // TODO: Is post going to be synchronous? We can't really change
    // the text after the user has typed unless the text still
    // matches what we sent.
    var res = $.ajax({
      beforeSend: function(xhr) {
        xhr.setRequestHeader("Authorization", basicAuthHeader());
      },
      type: "POST",
      url: checkUrl,
      data: { q: plaintext },
      success: cb,
      error: function(jqXHR, textStatus/*:string*/, err/*:string*/) {
        if(textStatus === "error" && err === "Unauthorized") {
          $("#serverfault").html("Feil brukarnamn/passord; ver venleg og logg inn: ");
        }
        else{
          $("#serverfault").html("Ånei! Fekk<div>"+textStatus+": "+err+"</div>frå tenaren");
        }
        $("#serverfault").show();
        $("#login").show();
        window.localStorage.removeItem("auth");
      },
      dataType: "json"
    });
    log(res);
  };

  /**
   * Get plaintext while preserving line breaks; might break on some browsers? TODO test
   * http://stackoverflow.com/a/3813520/69663
   */
  var getInnerText = function(el/*:Node*/)/*:string*/ {
    var sel, range, innerText = "";
    if (typeof document.selection != "undefined" && typeof document.body.createTextRange != "undefined") {
      range = document.body.createTextRange();
      range.moveToElementText(el);
      innerText = range.text;
    }
    else if (typeof window.getSelection != "undefined" && typeof document.createRange != "undefined") {
      sel = window.getSelection();
      sel.selectAllChildren(el);
      innerText = "" + sel;
      sel.removeAllRanges();
    }
    return innerText;
  };

  /**
   * Get plain text of element
   */
  var toPlainText = function(el/*:Node*/)/*:string*/ {
    return getInnerText(el)
      .replace(/\n\n+/, "\n☃\n") // preserve double line breaks, but
      .replace(/\s\s+/g, " ")    // turn any other multi-space into single-space
      .replace(/☃/,"")           // (assuming no snowmen in input)
      .trim();
  };

  var passwordIsOK = function()/*:void*/ {
    // If we got this far, then username and password must be correct:
    $("#login").hide();
    window.localStorage["auth"] = basicAuthHeader();
  };

  /**
   * Gather plaintext, call server, change DOM
   */
  var checkit = function(e)/*:void*/ {
    //log("checkit");
    e.stopPropagation();
    $("#serverfault").hide();
    var plaintext = toPlainText($("#form").get(0));
    window.localStorage["text"] = plaintext;
    servercheck(plaintext,
                function(res) {
                  passwordIsOK();
                  squiggle(res.text, res.errs);
                  if(debug && $('.error').length > 0) {
                    $('.error')[0].click();
                  }
                });
  };

  var appendText = function(el, text/*:string*/) {
    // log(text);
    var s = text.split(/\n/g);
    // log(s);
    for(var i=0; i<s.length; i++) {
      if(i>0) {
        // log("br");
        el.append($(document.createElement('br')));
      }
      // log("s",s[i]);
      el.append($(document.createTextNode(s[i])));
    }
  };

  /**
   * Changes DOM
   *
   * The text replaces the content of #form, and adds spans to errors
   * of errs.
   *
   * @param {string} text
   * @param {Array} errs
   */
  var squiggle = function(text/*:string*/, errors/*:errlist*/)/*:void*/  {
    //log("squiggle");
    // Ensure the first error (by start-offset) is first:
    errors.sort(function(a,b){return a[1] - b[1];});

    var form = $('#form');
    form.empty();
    for(var i=0, done=0; i < errors.length; i++) {
      var str = errors[i][0],
          beg = errors[i][1],
          end = errors[i][2],
          typ = errors[i][3],
          msg = errors[i][4],
          rep = errors[i][5],
          pre = text.slice(done, beg),
          err = text.slice(beg, end),
          span = $(document.createElement('span'));
      if(beg < done) {
        log("Overlapping (or unsorted) errors! Skipping error ", errors[i]);
        continue;
      }
      if(end < beg) {
        log("Impossible offsets! Skipping error ", errors[i]);
        continue;
      }
      // log("!",done,beg,end,typ,pre,"←pre,err→",err);
      appendText(form, pre);
      appendText(span, err);
      span.click({typ:typ, msg:msg, rep:rep},
                 function (e) {
                   e.stopPropagation();
                   return showrep(this,
                                  e.data.typ,
                                  e.data.msg,
                                  e.data.rep);
                 });
      span.addClass("error");
      form.append(span);
      done = end;
    }
    appendText(form, text.slice(done));
  };

  /**
   * Changes DOM
   */
  var hiderep = function()/*:void*/ {
    //log("hiderep");
    var repmenu = $('#repmenu');
    repmenu.offset({top:0, left:0}); // avoid some potential bugs with misplacement
    repmenu.hide();
  };

  /**
   * Changes DOM
   * TODO: populate menu, handle replacement
   */
  var showrep = function(span/*:Node*/,
                         typ/*:string*/,
                         msg/*:string*/,
                         rep/*:reps*/
                        )/*:void*/  {
    //log("showrep");
    var spanoff = $(span).offset();
    var newoff = { top:  spanoff.top+20,
                   left: spanoff.left };
    var repmenu = $('#repmenu');
    var at_same_err = repmenu.offset().top == newoff.top && repmenu.offset().left == newoff.left;
    if(repmenu.is(":visible") && at_same_err) {
      hiderep();
    }
    else {
      repmenu.show();
      repmenu.offset(newoff);
      if(!at_same_err) {
        makerepmenu(span, msg, rep);
      }
    }
  };

  /**
   * Changes DOM
   * Populates menu.
   * TODO: ignore-button
   */
  var makerepmenu = function(span/*:Node*/,
                             msg/*:string*/,
                             rep/*:reps*/
                            )/*:void*/  {
    // We're looking at a new error, populate the table anew:
    $("#repmenu_tbl").empty();
    var tbody = $(document.createElement('tbody')),
        tr_title =  $(document.createElement('tr')),
        td_title =  $(document.createElement('td')),
        a_title =  $(document.createElement('a'));
    a_title.text(msg);
    a_title.attr("aria-disabled", "true");
    a_title.attr("role", "option");
    td_title.append(a_title);
    td_title.addClass("repmenu_title");
    tr_title.append(td_title);
    tbody.append(tr_title);

    rep.map(function(r){
      var tr_rep =  $(document.createElement('tr')),
          td_rep =  $(document.createElement('td')),
          a_rep =  $(document.createElement('a'));
      a_rep.text(r);
      a_rep.attr("aria-disabled", "true");
      a_rep.attr("role", "option");
      td_rep.append(a_rep);
      td_rep.addClass("repmenu_rep");
      td_rep.addClass("repmenu_nonfirst");
      // has to be on td since <a> doesn't fill the whole td
      td_rep.click({span:span, r:r},
                   function(e){
                     var r = e.data.r,
                         span = $(e.data.span);
                     span.replaceWith(r);
                     hiderep();
                   });
      tr_rep.append(td_rep);
      tbody.append(tr_rep);
    });

    var tr_ign =  $(document.createElement('tr')),
        td_ign =  $(document.createElement('td')),
        a_ign =  $(document.createElement('a'));
    a_ign.text("Ignorer feiltypen");
    a_ign.attr("aria-disabled", "true");
    a_ign.attr("role", "option");
    td_ign.append(a_ign);
    td_ign.addClass("repmenu_ign");
    td_ign.addClass("repmenu_nonfirst");
    tr_ign.append(td_ign);
    tbody.append(tr_ign);

    $("#repmenu_tbl").append(tbody);
  };

  var check_on_enter = function (e)/*:bool*/ {
    if(e.which === 13)
    {
      // TODO: In Firefox, this gives NS_ERROR_FAILURE in line 85
      // (sel.selectAllChildren(el);)
      $("#check_b").trigger("click");
      return false;
    }
    return true;
  };

  var init = function ()/*:void*/ {
    var exampletext = $("#form").text();
    if(window.localStorage["exampletext"] != exampletext) {
      // If the index.html example text changed, we want to show that to the user:
      $("#form").text(window.localStorage["exampletext"]);
      window.localStorage["exampletext"] = exampletext;
    }
    else if(window.localStorage["text"] != undefined) {
      $("#form").text(window.localStorage["text"]);
    };

    $("#check_b").click(checkit);
    $("#username").keypress(check_on_enter);
    $("#password").keypress(check_on_enter);
    $("#form").click(hiderep);

    $("#spinner").hide();
    $("#form").removeClass("loading");

    $(document)
      .ajaxStart(function () {
        $("#spinner").show();
        $("#form").addClass("loading");
      })
      .ajaxStop(function () {
        $("#spinner").hide();
        $("#form").removeClass("loading");
      });

    if(debug) {
      $("#check_b").trigger("click");
    }

  };
  window.onload=init;

})();
