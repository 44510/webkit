/*	
    IFStandardPanelsPrivate.h
    
    Copyright 2002 Apple, Inc. All rights reserved.
*/

#import <WebKit/IFStandardPanels.h>
#import <WebKit/IFWebController.h>

@interface IFStandardPanels (Private)

-(void)_didStartLoadingURL:(NSURL *)url inController:(id<IFWebController>)controller;
-(void)_didStopLoadingURL:(NSURL *)url inController:(id<IFWebController>)controller;

@end
