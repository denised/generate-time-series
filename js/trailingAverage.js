/*
 * Given a data series (in the same format as for flot.js),
 * compute a trailing average for that series, and return it as
 * a new series.
 * Note that the trailing average is computed with respect to
 * a *time window* not with respect to a number of data points.
 * The returned series will give averages at the same time
 * points as the original series.
 * The window must be expressed in millis.
 *
 * Copyright (c) 2015 Denise Draper
 * Released under the MIT license
 */
function trailingAverage( data, window ) {
	"use strict";

	if ( data.length < 1 ) {
		return [];
	}

	// we process the data backwards, so we can neatly add and drop from the sum
	var dataI = data.length - 1;	// index of the point we're computing avg. for
	var frontierJ = data.length;	// index of how far into the data we've gone
	var datatime = data[dataI][0];	// time of current datapoint
	var result = [];
	var runningsum = 0;
	var runningcount = 0;
	var frontierpoint, oldpoint;	// datapoints at frontierJ and dataI respectively.

	while ( frontierJ > 0 ) {
		frontierpoint = data[--frontierJ];
		// if we've exited the window, emit points until the window catches up.
		while( frontierpoint[0] + window < datatime ) {
			result.shift( [datatime, runningsum / runningcount ] );
			runningsum -= data[dataI][1];
			runningcount--;
			dataI--;
			datatime = data[dataI][0];
		}

		runningsum += frontierpoint[1];
		runningcount++;
	}

	// Todo: termination condition at last point?
	return result;
}
