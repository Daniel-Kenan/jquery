import chalk from "chalk";
import { getBrowserString } from "../lib/getBrowserString.js";
import { checkLastTouches, createBrowserWorker, setBrowserWorkerUrl } from "./browsers.js";

const TEST_POLL_TIMEOUT = 1000;

const queue = [];

export function getNextBrowserTest( reportId ) {
	const index = queue.findIndex( ( test ) => test.id === reportId );
	if ( index === -1 ) {
		return;
	}

	// Remove the completed test from the queue
	const previousTest = queue[ index ];
	queue.splice( index, 1 );

	// Find the next test for the same browser
	for ( const test of queue.slice( index ) ) {
		if ( test.fullBrowser === previousTest.fullBrowser ) {

			// Set the URL for our tracking
			setBrowserWorkerUrl( test.browser, test.url );
			test.running = true;

			// Return the URL for the next test.
			// listeners.js will use this to set the browser URL.
			return { url: test.url };
		}
	}
}

export function retryTest( reportId, maxRetries ) {
	const test = queue.find( ( test ) => test.id === reportId );
	if ( test ) {
		test.retries++;
		if ( test.retries <= maxRetries ) {
			console.log(
				`Retrying test ${ reportId } for ${ chalk.yellow(
					test.options.modules.join( ", " )
				) }...${ test.retries }`
			);
			return test;
		}
	}
}

export function addBrowserStackRun( url, browser, options ) {
	queue.push( {
		browser,
		fullBrowser: getBrowserString( browser ),
		id: options.reportId,
		url,
		options,
		retries: 0,
		running: false
	} );
}

export async function runAllBrowserStack() {
	return new Promise( async( resolve, reject )=> {
		while ( queue.length ) {
			try {
				await checkLastTouches();
			} catch ( error ) {
				reject( error );
			}

			// Run one test URL per browser at a time
			const browsersTaken = [];
			for ( const test of queue ) {
				if ( browsersTaken.indexOf( test.fullBrowser ) > -1 ) {
					continue;
				}
				browsersTaken.push( test.fullBrowser );
				if ( !test.running ) {
					test.running = true;
					try {
						await createBrowserWorker( test.url, test.browser, test.options );
					} catch ( error ) {
						reject( error );
					}
				}
			}
			await new Promise( ( resolve ) => setTimeout( resolve, TEST_POLL_TIMEOUT ) );
		}
		resolve();
	} );
}
