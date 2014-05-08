// better function for getting cookies
function getCookies(domain, name, callback) {
    chrome.cookies.get({"url": domain, "name": name}, function(cookie) {
        if(callback) {
            callback(cookie);
        }
    });
}


// handle the display of notifications
var notifications = new Array();

/* old webkit notifications implementation(for linux) 

	**** rich notifications seem to be working on ubuntu
	
function displayNotificationLinux(type, timeLeft){
	timeLeft = (typeof timeLeft === "undefined") ? 0 : timeLeft;
	
	if(type == "reload"){
		var warning = window.webkitNotifications.createNotification(
			'48.png',
			"WARNING",
			'Edline has been refreshed to save your session. You can disable this on the option page.'
		);
		warning.onclose = function() { 
			// delete itself from notifications array (not added yet)
		};
		warning.show();
		notifications.push(warning);
	} else if(type == "time") {
		var warning = window.webkitNotifications.createNotification(
			'48.png',
			"WARNING",
			'Edline is going to log you off in: ' + timeLeft + ' minutes'
		);
		warning.onclose = function() { 
			// delete itself from notifications array (not added yet)
		};
		warning.show();
		notifications.push(warning);
	}
}

function clearEdlineNotificationsLinux(){
	if (typeof notifications !== 'undefined' && notifications.length > 0) {
		for (var i = 0; i < notifications.length; i++) {
			notifications[i].close()
		}
		notifications = new Array();
		console.log("EXISTING NOTIFICATIONS CLEARED");
	}
}
*/

/* rich notifications (windows, mac, ubuntu) */

// get permission level of rich notifications
var permLevel = "";
chrome.notifications.getPermissionLevel(function (level){
	permLevel = level;
});

function displayNotification(type, timeLeft){
	timeLeft = (typeof timeLeft === "undefined") ? 0 : timeLeft;
	if(type == "reload"){
		var message = "Edline has been refreshed to save your session. You can disable this on the option page.";
		var options = {"type": "basic", "iconUrl": "128.png", "title": "WARNING", "message": message, "buttons": [{"title": "Options"}]};
		chrome.notifications.create("", options, function (notificationId){
			notifications.push(notificationId);
		});
	} else if(type == "time") {
		var message = "";
		if(timeLeft == 0){
			message = "Edline has logged you out.";
		} else {
			message = "Edline is going to log you off in: " + timeLeft + " minutes";
		}
		var options = {"type": "basic", "iconUrl": "128.png", "title": "WARNING", "message": message, "buttons": [{"title": "Options"}, {"title": "Reload Edline"}]};
		chrome.notifications.create("", options, function (notificationId){
			notifications.push(notificationId);
		});
	}
}

function clearEdlineNotifications(){
	if (typeof notifications !== 'undefined' && notifications.length > 0) {
		for (var i = 0; i < notifications.length; i++) {
			chrome.notifications.clear(notifications[i], function (wasCleared){
				if(wasCleared){
					console.log("NOTIFICATION " + notifications[i] + " CLEARED");
				} else {
					console.log("NOTIFICATION " + notifications[i] + " NOT CLEARED");
				}
			});
		}
	}
}

function clearAllNotifications(){
	var allNotificationIDs = null;
	chrome.notifications.getAll(function (IDS){
		if(IDS !== undefined && IDS !== null){
			allNotificationIDs = IDS;
		}
	});
						
	if(allNotificationIDs !== null){
		for (var i = 0; i < allNotificationIDs.length; i++) {
			chrome.notifications.clear(allNotificationIDs[i], function (wasCleared){
				if(wasCleared){
					console.log("NOTIFICATION " + notifications[i] + " CLEARED");
				} else {
					console.log("NOTIFICATION " + notifications[i] + " NOT CLEARED");
				}
			});
		}
	}
}

// notification button click listeners
chrome.notifications.onButtonClicked.addListener(function (notificationId, buttonIndex){
	if(buttonIndex == 0){
		var url = "chrome-extension://" + chrome.runtime.id + "/options.html";
		chrome.tabs.create({"url": url, "active": true});
	} else {
		var tempEdlineTab = null;
		chrome.tabs.query({"url": "*://*.edline.net/*"}, function(queryTabs) {
			if(queryTabs !== undefined){
				tempEdlineTab = queryTabs[0];
			}
		});
		
		setTimeout(function() { chrome.tabs.reload(tempEdlineTab.id); }, 300);
	}
});


// some time variables just in case
var time = /(..)(:..)/.exec(new Date());     // The prettyprinted time.
var hour = time[1] % 12 || 12;               // The prettyprinted hour.
var period = time[1] < 12 ? 'a.m.' : 'p.m.'; // The period of the day.


// Conditionally initialize the options.
if (!localStorage.isInitialized) {
  localStorage.autoRefresh = false;
  localStorage.frequency = 15;
  localStorage.isInitialized = true;
  console.log("NO LOCAL STORAGE");
}


// wait for variables to set, then run code
setTimeout(function() {
	// Test for notification support.
	if (permLevel.indexOf("g") != -1) {
		  
		var maxTime;
		var secondsPast = 0;
		var loggedIn = false;
		var urlCache = "";
		var edlineTab = null;
		  
		var overTime = 60;
		var warnings = 5;
		var reloadBuffer = 0;
		  
		setInterval(function() {
			// set max time based on user input
			if(JSON.parse(localStorage.autoRefresh)){
				maxTime = localStorage.frequency * 60;
			} else {
				maxTime = 15 * 60;
			}
			
			// find tab for edline
			chrome.tabs.query({"url": "*://*.edline.net/*"}, function(queryTabs) {
				if(queryTabs != undefined){
					edlineTab = queryTabs[0];
				}
			});
		  
			// if edline log on cookie exists, user is logged on 
			getCookies("http://www.edline.net", "XT", function(cookie) {
				if(cookie != undefined && cookie != null){
					loggedIn = true;
				} else {
					loggedIn = false;
				}
			});
			
			// make sure edline tab exists
			if(edlineTab == null && loggedIn){
				// tab was closed without log out
				chrome.cookies.remove({"url": "http://www.edline.net", "name": "XT"});
				console.log("LOGGED OUT GLITCH");
			} else if(!loggedIn){
				// if user not logged in, ignore rest of code
				secondsPast = 0;
				urlCache = "";
				console.log("NOT LOGGED IN");
				return;
			} else if(loggedIn){
				// if user logged on, check timer
				if(secondsPast == 0){
					// if no seconds have past, set all initial values
					urlCache = edlineTab.url;
					secondsPast++;
					
					console.log("START");
				} else if (secondsPast > 0){
					// if seconds have past, run checks on data
					if(edlineTab.url != urlCache){
						// if the page is not the same, reset timer
						secondsPast = 0;
						urlCache = edlineTab.url;
						overTime = 60;
						warnings = 5;
						reloadBuffer = 0;
						
						console.log("DIFFERENT PAGE RESET");
				
						// rich notifications automatically disappear
						// clearEdlineNotifications();
					} else if (edlineTab.status == "loading"){
						// if page is loading(new request by user), reset timer
						secondsPast = 0;
						urlCache = edlineTab.url;
						overTime = 60;
						warnings = 5;
						reloadBuffer = 0;
				
						console.log("LOADING PAGE RESET");
				
						// rich notifications automatically disappear 
						// clearEdlineNotifications();
					} else {
						// user is still idle
						if(secondsPast > maxTime){
							// exceeded max time, alert user or refresh automatically
							if(JSON.parse(localStorage.autoRefresh) && reloadBuffer != 1){
								/* rich notification code */
								// check if they want to display notifications
								if(JSON.parse(localStorage.displayNot)){
									displayNotification("reload");
								}
								
								// old webkit notifications code
								// displayNotification("reload");
						
								reloadBuffer = 1;
								chrome.tabs.reload(edlineTab.id);
							} else if(overTime >= 60 && warnings >= 0 && reloadBuffer != 1 && JSON.parse(localStorage.timeOut)){
								/* rich notification code */
								displayNotification("time", warnings);
						
								// old webkit notifications code
								// displayNotification("time", warnings);
						
								overTime = 0;
								warnings -= 1;
							} /*else if(overTime == 15) {
								// clear notifications after 15 seconds
								// rich notifications automatically disappear
								//clearEdlineNotifications();
							}*/
							overTime++;
					
							console.log("IDLE: NO TIME");
						} else {
							// user still has time, continue iterate
							urlCache = edlineTab.url;
							secondsPast++;
					
							console.log("IDLE: WITH TIME");
							console.log("SECONDS PAST: " + secondsPast.toString());
						}
					}
				}
			}
		}, 1000); // run test every second
	} else {
		console.log("no notification support");
	}
}, 2000);

