/*
 * Copyright (C) 2004, 2006 Apple Computer, Inc.  All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE COMPUTER, INC. ``AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL APPLE COMPUTER, INC. OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
 * OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. 
 */

#ifndef ResourceHandle_h
#define ResourceHandle_h

#include <wtf/OwnPtr.h>

#include "HTTPHeaderMap.h"

#if PLATFORM(WIN)
typedef unsigned long DWORD;
typedef unsigned long DWORD_PTR;
typedef void* LPVOID;
typedef LPVOID HINTERNET;
typedef unsigned WPARAM;
typedef long LPARAM;
typedef struct HWND__* HWND;
typedef _W64 long LONG_PTR;
typedef LONG_PTR LRESULT;
#endif

#if PLATFORM(MAC)
#ifdef __OBJC__
@class NSData;
@class NSError;
@class NSURLConnection;
@class NSURLRequest;
@class NSURLResponse;
@class WebCoreResourceHandleAsDelegate;
#else
class NSData;
class NSError;
class NSURLConnection;
class NSURLRequest;
class NSURLResponse;
class WebCoreResourceHandleAsDelegate;
typedef struct objc_object *id;
#endif
#endif

namespace WebCore {

class FormData;
class Frame;
class KURL;
class ResourceHandleClient;
class ResourceHandleInternal;
class SubresourceLoader;
class SubresourceLoaderClient;

struct ResourceRequest;

template <typename T> class Timer;

class ResourceHandle : public Shared<ResourceHandle> {
private:
    ResourceHandle(const ResourceRequest&, ResourceHandleClient*, bool defersLoading, bool mightDownloadFromHandle);

public:
    // FIXME: should not need the Frame
    static PassRefPtr<ResourceHandle> create(const ResourceRequest&, ResourceHandleClient*, Frame*, bool defersLoading, bool mightDownloadFromHandle = false);

    ~ResourceHandle();

#if PLATFORM(MAC)
    NSURLConnection *connection() const;
    WebCoreResourceHandleAsDelegate *delegate();
    void releaseDelegate();
    NSData* bufferedData();
    
    static bool supportsBufferedData();
    
    id releaseProxy();
#endif

#if USE(WININET)
    void setHasReceivedResponse(bool = true);
    bool hasReceivedResponse() const;
    void fileLoadTimer(Timer<ResourceHandle>*);
    void onHandleCreated(LPARAM);
    void onRequestRedirected(LPARAM);
    void onRequestComplete(LPARAM);
    friend void __stdcall transferJobStatusCallback(HINTERNET, DWORD_PTR, DWORD, LPVOID, DWORD);
    friend LRESULT __stdcall ResourceHandleWndProc(HWND, unsigned message, WPARAM, LPARAM);
#endif

#if PLATFORM(GDK) || PLATFORM(QT)
    ResourceHandleInternal* getInternal() { return d.get(); }
#endif

    // Used to work around the fact that you don't get any more NSURLConnection callbacks until you return from the one you're in.
    static bool loadsBlocked();    
    
    void cancel();
    
    ResourceHandleClient* client() const;
    void setDefersLoading(bool);
      
    const HTTPHeaderMap& requestHeaders() const;
    const KURL& url() const;
    const String& method() const;
    PassRefPtr<FormData> postData() const;
    const ResourceRequest& request() const;

private:
    bool start(Frame*);

    OwnPtr<ResourceHandleInternal> d;
};

}

#endif // ResourceHandle_h
