/* global interpolate */
// IE<9 lacks Array.prototype.indexOf
if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function(needle) {
        for (i=0, l=this.length; i<l; ++i) {
            if (this[i] === needle) return i;
        }
        return -1;
    }
}

(function($){
    // Patch up urlify maps to generate nicer slugs in german
    if(typeof(Downcoder) != "undefined"){
        Downcoder.Initialize() ;
        Downcoder.map["ö"] = Downcoder.map["Ö"] = "oe";
        Downcoder.map["ä"] = Downcoder.map["Ä"] = "ae";
        Downcoder.map["ü"] = Downcoder.map["Ü"] = "ue";
    }

    /* .dataset.context instead of getAttribute would be nicer */
    var ItemEditor = JSON.parse(
        document.getElementById('item-editor-script').getAttribute('data-context'));

    var ACTIVE_REGION = 0;

    function create_new_item_from_form(form, modname, modvar){

        var fieldset = $("<fieldset>").addClass("module aligned order-item item-wrapper-" + modvar);
        var original_id_id = '#id_' + form.attr('id') + '-id';

        var wrp = ['<h2>'];
        // If original has delete checkbox or this is a freshly added CT? Add delete link!
        if($('.delete', form).length || !$(original_id_id, form).val()) {
            wrp.push('<img class="item-delete" src="'+IMG_DELETELINK_PATH+'" />');
        }
        wrp.push('<span class="handle"></span> <span class="modname">'+modname+'</span></h2>');
        wrp.push('<div class="item-content"></div>');
        fieldset.append(wrp.join(""));

        fieldset.children(".item-content").append(form); //relocates, not clone

        $("<div>").addClass("item-controls").appendTo(fieldset);

        return fieldset;
    }


    var SELECTS = {};
    function save_plugin_selects() {
        $('#main>.panel').each(function() {
            SELECTS[this.id.replace(/_body$/, '')] = $("select[name=order-machine-add-select]", this).clone().removeAttr("name");
        });
    }

    function update_item_controls(item, target_region_id){
        var item_controls = item.find(".item-controls");
        item_controls.empty();

        // Insert control unit
        var insert_control = $("<div>").addClass("item-control-unit");
        var select_content = SELECTS[ItemEditor.regionNames[target_region_id]].clone();

        select_content.change(function() {
            var modvar = select_content.val();
            var modname = select_content.find("option:selected").html();
            var new_fieldset = create_new_fieldset_from_module(modvar, modname);
            add_fieldset(target_region_id, new_fieldset, {where:'insertBefore', relative_to:item, animate:true});
            update_item_controls(new_fieldset, target_region_id);

            select_content.val('');
        });
        insert_control.append(select_content);
        item_controls.append(insert_control);

        // Move control unit
        if (ItemEditor.regionNames.length > 1) {
            var wrp = [];
            wrp.push('<div class="item-control-unit move-control"><select name="item-move-select">');
            wrp.push('<option disabled selected>' + ItemEditor.messages.moveToRegion + '</option>');

            for (var i=0; i < ItemEditor.regionNames.length; i++) {
                if (i != target_region_id) { // Do not put the target region in the list
                    wrp.push('<option value="'+ItemEditor.regionNames[i]+'">'+ItemEditor.regionTitles[i]+'</option>');
                }
            }
            wrp.push('</select>');

            var move_control = $(wrp.join(""));
            move_control.find("select").change(function(){
                var move_to = $(this).val();
                move_item(ItemEditor.regionNames.indexOf(move_to), item);
            });
            item_controls.append(move_control); // Add new one
        }
    }


    function create_new_fieldset_from_module(modvar, modname) {
        var new_form = create_new_spare_form(modvar);
        return create_new_item_from_form(new_form, modname, modvar);
    }

    function add_fieldset(region_id, item, how){
        /* `how` should be an object.
           `how.where` should be one of:
         - 'append' -- last region
         - 'prepend' -- first region
         - 'insertBefore' -- insert before relative_to
         - 'insertAfter' -- insert after relative_to */

        // Default parameters
        if (how) $.extend({
            where: 'append',
            relative_to: undefined,
            animate: false
        }, how);

        item.hide();
        if(how.where == 'append' || how.where == 'prepend'){
            $("#"+ ItemEditor.regionNames[region_id] +"_body").children("div.order-machine")[how.where](item);
        }
        else if(how.where == 'insertBefore' || how.where == 'insertAfter'){
            if(how.relative_to){
                item[how.where](how.relative_to);
            }
            else{
                window.alert('DEBUG: invalid add_fieldset usage');
                return;
            }
        }
        else{
            window.alert('DEBUG: invalid add_fieldset usage');
            return;
        }
        set_item_field_value(item, "region-choice-field", region_id);
        init_contentblocks();

        if (how.animate) {
            item.fadeIn(800);
        }
        else {
            item.show();
        }
    }

    function create_new_spare_form(modvar) {
        $('#'+modvar+'_set-group').find('div.add-row > a').triggerHandler('click');
        var new_form_count = parseInt($('#id_'+modvar+'_set-TOTAL_FORMS').val(), 10);
        return $('#'+modvar+'_set-'+(new_form_count-1));
    }

    function set_item_field_value(item, field, value) {
        // item: DOM object for the item's fieldset.
        // field: "order-field" | "delete-field" | "region-choice-field"
        if (field=="delete-field")
            item.find("."+field).attr("checked",value);
        else if (field=="region-choice-field") {
            var old_region_id = ItemEditor.regionNames.indexOf(item.find("."+field).val());
            item.find("."+field).val(ItemEditor.regionNames[value]);

            // show/hide the empty machine message in the source and
            // target region.
            old_region_item = $("#"+ItemEditor.regionNames[old_region_id]+"_body");
            if (old_region_item.children("div.order-machine").children().length == 0)
                old_region_item.children("div.empty-machine-msg").show();
            else
                old_region_item.children("div.empty-machine-msg").hide();

            new_region_item = $("#"+ItemEditor.regionNames[value]+"_body");
            new_region_item.children("div.empty-machine-msg").hide();
        }
        else
            item.find("."+field).val(value);
    }

    function move_item(region_id, item) {
        poorify_rich(item);
        item.fadeOut(800, function() {
            add_fieldset(region_id, item, {where:'append'});
            richify_poor(item);
            update_item_controls(item, region_id);
            item.show();
        });
    }

    function poorify_rich(item){
        item.children(".item-content").hide();

        for (var i=0; i<contentblock_move_handlers.poorify.length; i++)
            contentblock_move_handlers.poorify[i](item);
    }

    function richify_poor(item){
        item.children(".item-content").show();

        for (var i=0; i<contentblock_move_handlers.richify.length; i++)
            contentblock_move_handlers.richify[i](item);
    }

    function sort_by_ordering(e1, e2) {
      var v1 = parseInt($('.order-field', e1).val(), 10) || 0;
      var v2 = parseInt($('.order-field', e2).val(), 10) || 0;
      return  v1 > v2 ? 1 : -1;
    }

    function give_ordering_to_plugins() {
      for (var i=0; i<ItemEditor.regionNames.length;i++) {
        var container = $("#"+ItemEditor.regionNames[i]+"_body div.order-machine");
        for (var j=0; j<container.children().length; j++) {
          set_item_field_value(container.find("fieldset.order-item:eq("+j+")"), "order-field", j);
        }
      }
    }

    function order_plugins_in_regions() {
      for (var i=0; i<ItemEditor.regionNames.length;i++) {
        var container = $("#"+ItemEditor.regionNames[i]+"_body div.order-machine");
        container.children().sort(sort_by_ordering).each(function() {
          container.append(this);
        });
      }
    }

    function init_contentblocks() {
        for(var i=0; i<contentblock_init_handlers.length; i++)
            contentblock_init_handlers[i]();
    }

    function init_plugin_buttons() {
        $('#main > .panel').each(function() {
            var $select = $('select[name=order-machine-add-select]', this);

            $select.change(function() {
                var modvar = $select.val();
                // bail out early if no content type selected
                if (!modvar)
                    return;

                var modname = $select.find("option:selected").html();
                var new_fieldset = create_new_fieldset_from_module(modvar, modname);
                add_fieldset(ACTIVE_REGION, new_fieldset, {where:'append', animate:true});
                update_item_controls(new_fieldset, ACTIVE_REGION);

                $select.val('');
            });


            for (var i=0; i<PLUGIN_BUTTONS.length; i++) {
                var c = PLUGIN_BUTTONS[i],
                    $option = $select.find('option[value=' + c.type + ']');

                if (!$option.length)
                    continue;

                var $button = $('<a href="#" class="actionbutton" />');
                $button.attr('title', ItemEditor.plugins[c.type]);

                $button.addClass(c.cssclass ? c.cssclass : c.type).bind('click', (function(c) {
                    return function() {
                        var fieldset = ItemEditor.add_content_to_current(c.type);
                        if (c.raw_id_picker) {
                            var id = fieldset.find('.related-lookup, span.mediafile').attr('id');

                            if (id) {
                                window.open(c.raw_id_picker,
                                    id_to_windowname(id.replace(/^lookup_/, '')),
                                    'height=500,width=800,resizable=yes,scrollbars=yes').focus();
                            }
                        }
                        if (c.after)
                            c.after.call(null, fieldset);
                        return false;
                    };
                })(c));

                $select.parent().append($button);
            }

            if ($select.find('option').length == 0) {
                // hide the content type select box and the add button if
                // the dropdown is empty now
                $select.hide().next().hide();
            }
        });
    }

    function create_tabbed(_tab_selector, _main_selector, _switch_cb) {
        var tab_selector = _tab_selector,
            main_selector = _main_selector,
            switch_cb = _switch_cb;

        $(tab_selector).addClass('clearfix');

        $(tab_selector + " > .navi_tab").on('click', function() {
            var elem = $(this),
                tab_str = elem.attr("id").substr(0, elem.attr("id").length-4);

            if (elem.hasClass('tab_active') && tab_str.indexOf('extension_option') != -1) {
                elem.removeClass('tab_active');
                $('#' + tab_str + '_body').hide();
            } else {

                $(tab_selector + " > .navi_tab").removeClass("tab_active");
                elem.addClass("tab_active");
                $(main_selector + " > div:visible, " + main_selector + " > fieldset:visible").hide();

                $('#'+tab_str+'_body').show();

                if(switch_cb) {
                    switch_cb(tab_str);
                }
            }
        });
    }

    // global variable holding the current template key
    var current_template;

    $(document).ready(function($){
        create_tabbed('#main_wrapper', '#main', function(tab_str){
            ACTIVE_REGION = ItemEditor.regionNames.indexOf(tab_str);
            // make it possible to open current tab on page reload
            window.location.replace('#tab_'+tab_str);
        });

        /* Rearrange the options fieldsets so we can wrap them into a tab bar */
        var options_fieldsets = $('fieldset.collapse');
        options_fieldsets.wrapAll('<div id="extension_options_wrapper" />');
        var option_wrapper = $('#extension_options_wrapper');
        var panels = [];

        options_fieldsets.each(function(idx, elem) {
            var option_title = $('h2', $(elem)).text();
            var c = $(elem).children('div');
            var id_base = 'extension_option_'+ idx;

            $(elem).remove();

            var paren = option_title.indexOf(' (');
            if(paren > 0)
                option_title = option_title.substr(0, paren);

            option_wrapper.append('<div class="navi_tab" id="'+ id_base +'_tab">' +
                                   option_title +
                                   '</div>');
            var panel = $('<fieldset class="module aligned" style="clear: both; display: none" id="' + id_base + '_body"></fieldset>');
            panel.html(c);
            panels.push(panel);
        });

        option_wrapper.append('<div id="extension_options" />');
        $('#extension_options').html(panels);

        create_tabbed('#extension_options_wrapper', '#extension_options');
        /* Done morphing extension options into tabs */

        // save content type selects for later use
        save_plugin_selects();

        $(document.body).on('click', 'h2 img.item-delete', function() {
            var item = $(this).parents(".order-item");
            if (confirm(ItemEditor.messages.delete)) {
                var in_database = item.find(".delete-field").length;
                if(in_database==0){ // remove on client-side only
                    var id = item.find(".item-content > div").attr('id');

                    // poorify all contents
                    items = item.parents('.order-machine').find('.order-item');
                    items.each(function() {
                      poorify_rich($(this));
                    })

                    // remove content
                    django.jQuery('#'+id).find('a.inline-deletelink')
                      .triggerHandler('click');

                    // richify all contents again
                    items.each(function() {
                      richify_poor($(this));
                    })
                }
                else{ // saved on server, don't remove form
                    set_item_field_value(item,"delete-field","checked");
                }
                item.fadeOut(200, function() {
                  var region_item = $("#"+ItemEditor.regionNames[ACTIVE_REGION]+"_body");
                  if (region_item.children("div.order-machine").children(":visible").length == 0) {
                      region_item.children("div.empty-machine-msg").show();
                  }
                });
            }
        });

        current_template = $('input[name=template_key][checked], select[name=template_key]').val();

        function on_template_key_changed(){
            var input_element = this;
            var new_template = this.value;
            var form_element = $(input_element).parents('form');

            if(current_template==new_template)
                // Selected template did not change
                return false;

            var current_regions = template_regions[current_template];
            var new_regions = template_regions[new_template];

            var not_in_new = [];
            for(var i=0; i<current_regions.length; i++)
                if(new_regions.indexOf(current_regions[i])==-1)
                    not_in_new.push(current_regions[i]);

            var msg = ItemEditor.messages.changeTemplate;

            if(not_in_new.length) {
                msg = interpolate(ItemEditor.messages.changeTemplateWithMove, {
                    'source_regions': not_in_new,
                    'target_region': new_regions[0]
                }, true);
            }

            if (confirm(msg)) {
                for(var i=0; i<not_in_new.length; i++) {
                    var body = $('#' + not_in_new[i] + '_body'),
                        machine = body.find('.order-machine'),
                        inputs = machine.find('input[name$=region]');

                    inputs.val(new_regions[0]);
                }

                input_element.checked = true;

                form_element.append('<input type="hidden" name="_continue" value="1" />');
                /* Simulate a click on the save button instead of form.submit(), so
                   that the submit handlers from FilteredSelectMultiple get
                   invoked. See Issue #372 */
                form_element.find('[type=submit][name=_save]').click();
            } else {
                // Restore original value
                form_element.val($(input_element).data('original_value'));
            }

            return false;
        }

        // The template key's widget could either be a radio button or a drop-down select.
        var template_key_radio = $('input[type=radio][name=template_key]');
        template_key_radio.click(on_template_key_changed);
        var template_key_select = $('select[name=template_key]');
        template_key_select.change(on_template_key_changed);

        // Save template key's original value for easy restore if the user cancels the change.
        template_key_radio.data('original_value', template_key_radio.val());
        template_key_select.data('original_value', template_key_select.val());

        $('form').submit(function(){
            give_ordering_to_plugins();
            var form = $(this);
            form.attr('action', form.attr('action')+window.location.hash);
            return true;
        });

        // move contents into their corresponding regions and do some simple formatting
        $("div.feincms_inline div.inline-related").each(function(){
            var elem = $(this);
            if (elem.find("span.delete input").attr("checked")) {
                // ignore all inlines that are set to be deleted by reversion
                return;
            }

            elem.find("input[name$=-region]").addClass("region-choice-field");
            elem.find("input[name$=-DELETE]").addClass("delete-field");
            elem.find("input[name$=-ordering]").addClass("order-field");

            if (!elem.hasClass("empty-form")){
                var region_id = ItemEditor.regionNames.indexOf(
                    elem.find(".region-choice-field").val());
                if (ItemEditor.regionNames[region_id] != undefined) {
                    var plugin = elem.attr("id").substr(
                        0, elem.attr("id").lastIndexOf("_"));
                    var item = create_new_item_from_form(
                        elem, ItemEditor.plugins[plugin], plugin);
                    add_fieldset(region_id, item, {where:'append'});
                    update_item_controls(item, region_id);
                }
            }
        });
        // register regions as sortable for drag N drop
        $(".order-machine").sortable({
            handle: '.handle',
            helper: function(event, ui){
                var h2 = $("<h2>").html($(ui).find('span.modname').html());
                return $("<fieldset>").addClass("helper module").append(h2);
            },
            placeholder: 'highlight',
            start: function(event, ui) {
                poorify_rich($(ui.item));
            },
            stop: function(event, ui) {
                richify_poor($(ui.item));
            }
        });

        order_plugins_in_regions();

        // hide now-empty formsets
        $('div.feincms_inline').hide();

        // add quick buttons to order machine control
        init_plugin_buttons();

        /* handle Cmd-S and Cmd-Shift-S as save-and-continue and save respectively */
        $(document.documentElement).keydown(function(event) {
            if(event.which == 83 && event.metaKey) {
                sel = event.shiftKey ? 'form:first input[name=_continue]' :
                    'form:first input[name=_save]';
                $(sel).click();
                return false;
            }
        });


        var errors = $('#main div.errors');

        if(errors.length) {
            var id = errors.parents('fieldset[id$=_body], div[id$=_body]').attr('id');
            $('#'+id.replace('_body', '_tab')).trigger('click');
        } else {
            if(window.location.hash) {
                var tab = $('#'+window.location.hash.substr(5)+'_tab');

                if(tab.length) {
                    tab.trigger('click');
                    return;
                }
            }

            $('#main_wrapper>div.navi_tab:first-child').trigger('click');
        }
    });

    $(window).load(init_contentblocks);

})(django.jQuery);