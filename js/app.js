// declared in global namespace so you can see/modify/use it in the console.
var app = {}; // move the decl inside the closure if you'd rather it were private.

require(
    ["js/dgen"],

    function( dgen ) {
        "use strict";

        app.theSeries = [];
        app.theTimeVector = [];
        app.theDataVector = [];
        app.theGenerators = [];

        app.componentTypes = {
            baseline: {
                param1: ["value", 10]
            },
            slope: {
                param1: ["from", -10],
                param2: ["to", 60]
            },
            noise: {
                distribution: ["type", "Uniform"],
                param1: ["spread", 3]
            },
            walk: {
                param1: ["between", -2],
                param2: ["and", 2]
            },
            cyclic: {
                period: ["period", "yearly"],
                param1: ["spread", 10]
            }
        };
        app.plotOptions = {
            xaxis: { mode: "time" },
            series: {
                points: { show: true },
                lines: { show: true, lineWidth: 0, fill: 0.2 },
                shadowSize: 0
            },
            colors: ["#c50d0d"],
            grid: {
                borderWidth: 1,
                hoverable: true
            }
        };
        app.clonable = undefined;
        app.dgen = dgen;

        app.init = function() {
            // initialize all widgets
            $( "button" ).button();
            $( ".select" ).selectmenu();
            $( ".datepicker" ).datepicker({ changeMonth: true, changeYear: true });
            // It's cute, but I'm not doing anything with it yet.
            // The idea was to have dragging be an easy way to weight the series
            // relative to one another.
            // $( "#component-list" ).sortable({
            //        handle : ".item-move"
            //    });

            // connect options to the range
            $("#data-point-frequency").on("selectmenuchange", app.showOptions);

            // wire the inside of the doohickey
            $(".item-close").on("click", app.removeComponent );
            $(".component-type").on("change", app.updateComponent );
            $("#add-item").on("click", app.addComponent );

            // make a copy for cloning later
            app.clonable = $("#component-list").children().clone(true,true);

            // add initial values
            $( "#min-time" ).val( "01/01/2012" );
            $( "#max-time" ).val( app.dateString( Date.now() ));
            app.updateComponent(false, $("#component-list li"));
            $( "#weekday-option" ).hide();
            $( "#daytime-option" ).hide();

            // init plot area
            $("#placeholder").height( Math.floor( $("#placeholder").width() * 0.35) );
            $("#placeholder").on("plothover", app.updateTooltip);
            $(window).resize( function() {
                $("#placeholder").height( Math.floor($("#placeholder").width() * 0.35));
            });

            // wire the buttons
            $("#generate").on("click", app.generate );
            $("#download").on("click", app.download );
            $("#show").on("click", function() { alert("TODO"); });
        };

        // main event(s)

        app.generate = function() {
            app.stepSize = app.stepSizes[ $("#data-point-frequency").val() ];
            app.theTimeVector = app.createTimeVector();
            app.theGenerators = app.createGenerators();
            app.theDataVector = new dgen.seqs.Combine( app.theGenerators ).array( app.theTimeVector.length );
            app.theSeries = app.zip( app.theTimeVector, app.theDataVector, $("#ints-only").prop("checked"));
            if ( $("#weekdays-only").prop("checked") || $("#daytime-only").prop("checked") ) {
                app.theSeries = app.filter( app.theSeries );
            }

            $.plot( $("#placeholder"), [app.theSeries], app.plotOptions );
        };

        app.download = function() {
            var contents, filename, filetype;
            switch( $("#file-format").val() ) {
                case "flot":
                    contents = JSON.stringify(app.theSeries);
                    filename = "series.json";
                    filetype = "text/plain";
                    break;
                case "csv":
                    contents = app.toCSV(app.theSeries, ($("#data-point-frequency").val() == "hourly"));
                    filename = "series.csv";
                    filetype = "text/plain";
                    break;
                default:
                    alert("Whoops.  TODO.");
                    return;
            }
            app.downloadFile(contents,filename,filetype);
        };

        // data generation

        // Generate the time sequence itself
        // TODO: this is a *very* crude way of generating time sequences that does not take into
        // account the variability of month lengths, leap years, etc.  Obvioiusly, we could
        // increment the appropriate Date field instead.   If we do that, a fine point: currently
        // the data generators also assume perfectly fixed step sizes, and we might have to
        // tweak them to behave correctly if the steps are not uniform.
        //
        // (Missing data is easier: just generate all the data then delete the bits you don't want.)
        //
        app.stepSize = 0;
        app.stepSizes = {
            hourly:             60 * 60 * 1000,
            daily:         24 * 60 * 60 * 1000,
            weekly:    7 * 24 * 60 * 60 * 1000,
            monthly:  30 * 24 * 60 * 60 * 1000,
            yearly:  365 * 24 * 60 * 60 * 1000,
        }
        app.createTimeVector = function( ) {
            var mfrom = app.stringMillis( "#min-time" );
            var mto = app.stringMillis( "#max-time" );
            if ( mto < mfrom ) {
                // TODO: should show an error.  for now just flip around
                var x = mto;
                mto = mfrom;
                mfrom = x;
            }
            var seq = new dgen.seqs.Arithmetic( mfrom, app.stepSize );
            var count = Math.floor( (mto - mfrom) / app.stepSize )
            // TODO: might want to cap count, or issue a warning, or ....
            return seq.array( count );
        };


        // Generate the data for the time sequence.
        app.createGenerators = function( ) {
            var result = [];
            var count = app.theTimeVector.length;

            $("#component-list li").each( function() {
                var gentype = $(this).children("select").val();
                var param1 = Number( $(this).find("[param=param1] input").val() );
                var param2 = Number( $(this).find("[param=param2] input").val() );
                var period = $(this).find("[param=period] select").val();
                var distribution = $(this).find("[param=distribution] select").val();
                var step, scaled;

                // TODO: clearly could make this into a pluggable architecture...
                switch( gentype ) {
                    case "baseline":
                        result.push( new dgen.seqs.Constant( param1 ));
                        break;
                    case "slope":
                        step = (param2 - param1) / count;
                        result.push( new dgen.seqs.Arithmetic( param1, step ));
                        break;
                    case "noise":
                        var rng = ( distribution == "Uniform" ?
                                        app.Uniform( param1 ) :
                                        // for normal, we interpret spread to be two standard deviations
                                        new dgen.rngs.Normal( 0, param1/2 ) );
                        result.push( new dgen.seqs.Random( rng ));
                        break;
                    case "walk":
                        result.push( new dgen.seqs.RandomWalk( new dgen.rngs.Uniform(), 0, param1, param2 ));
                        break;
                    case "cyclic":
                        // period for this function is defined by the ratio of requested periodicity to the data's
                        // frequency.
                        step = 2 * Math.PI * app.stepSize / app.stepSizes[period];
                        scaled = function(x) {
                            // transform the Sine function so that it has a period of step, and amplitude of spread.
                            return (param1/2) * Math.sin( step*x );
                        }
                        result.push( new dgen.seqs.Arithmetic(0,1).setMap(scaled) );
                    default:
                        break;
                }
            });
            return result;
        };

        // Uniform returns 0..1.  Scale so that it returns -width/2 ... width/2

        app.Uniform = function( width ) {
            var embedded = new dgen.rngs.Uniform();
            var translate = width / 2;
            return { next: function() {
                var x = embedded.next();
                return (x * width) - translate;
            }}
        };

        // Utilities
        app.dateString = function( dt ) {
            if( ! (dt instanceof Date) ) {
                dt = new Date(dt);
            }
            return $.datepicker.formatDate( "mm/dd/yy", dt );
        };

        app.stringMillis = function( id ) {
            return $.datepicker.parseDate( "mm/dd/yy", $(id).val() ).getTime();
        };


        app.zip = function(ar1,ar2,intigize) {
            return ar1.map(function(e,i) {
                return [ar1[i], (intigize ? Math.round(ar2[i]) : ar2[i])];
            });
        };

        var isweekday = function( dt ) { var x = new Date(dt).getDay(); return (x > 0 && x < 6); };
        var isdaytime = function( dt ) { var x = new Date(dt).getHours(); return ( x > 7 && x < 17 ); };
        var isboth = function( dt ) { return (isweekday(dt) && isdaytime(dt)); };
        app.filter = function( ary ) {
            var filterfn;
            var chosenOptions = "" + ($("#weekdays-only").prop("checked") ? "w" : "W") +
                                     ($("#daytime-only").prop("checked") ? "d" : "D" );
            switch ($("#data-point-frequency").val()) {
                case "hourly" :
                    filterfn = {"wd": isboth, "wD": isweekday, "Wd": isdaytime, "WD": false }[chosenOptions];
                    break;
                case "daily" :
                    filterfn = {"wd": isweekday, "wD": isweekday, "Wd": false, "WD": false }[chosenOptions];
                    break;
                default :
                    filterfn = false;
                    break;
            }

            if ( filterfn ) {
                return ary.filter( function( item ) { return filterfn(item[0]); });
            }
            else
                return ary;
        };


        app.toCSV = function( series, withtimes ) {
            var results = "";
            series.map( function(e) {
                var dt = new Date(e[0]);
                var x;
                if ( withtimes ) {
                    x = dt.getHours();
                    results += (x < 10 ? "0" : "") + x + ":";
                    x = dt.getMinutes();
                    results += (x < 10 ? "0" : "") + x;
                    results += ", ";
                }
                results += dt.toDateString() + ", ";
                results += e[1] + "\n";
            });
            return results;
        };


        // thank you http://stackoverflow.com/a/20796276/1539989
        app.downloadFile = function(str, filename, filetype) {

            var blob = new Blob([str], {type: filetype});

            if(window.navigator.msSaveOrOpenBlob) {
                window.navigator.msSaveOrOpenBlob(blob, filename);
            }
            else {
                var a = window.document.createElement('a');
                a.href = window.URL.createObjectURL(blob);
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        };

        // manage the component doohickey
        app.addComponent = function() {
            $("#component-list").append(app.updateComponent(false, app.clonable.clone(true,true)));
        };

        app.removeComponent = function() {
            $(this).closest("li").remove();
        };

        app.updateComponent = function(ev,elem) {
            // hide or show, and rename, parameters depending on what type of component this is
            var x = (ev ?  $(this).closest("li") : elem );
            var xtype = x.children("select").val();
            var xconfig = app.componentTypes[ xtype ];
            x.find(".param").each( function() {
                var c = xconfig[ $(this).attr("param") ];
                if ( c ) {
                    $(this).find(".paramname").text(c[0]);
                    $(this).find("input,select").val(c[1]);
                    $(this).show();
                }
                else {
                    $(this).hide();
                }
            })
            return x;
        };

        var tooltip = $("#tooltip");
        app.updateTooltip = function(event, pos, item) {
            if ( item ) {
                tooltip.html(new Date(item.datapoint[0]).toUTCString() + "<br>"  + item.datapoint[1] );
                tooltip.css({
                    left: pos.pageX,
                    top: pos.pageY-55
                })
                tooltip.show();
            }
            else {
                tooltip.hide();
            }
        };


        app.showOptions = function() {
            var freq = $("#data-point-frequency").val();
            if ( freq == "hourly" ) {
                $("#daytime-option").show();
                $("#weekday-option").show();
            }
            else if ( freq == "daily" ) {
                $("#daytime-option").hide();
                $("#weekday-option").show();
            }
            else {
                $("#daytime-option").hide();
                $("#weekday-option").hide();
            }
        }

        $("document").ready( app.init );
    }
);

