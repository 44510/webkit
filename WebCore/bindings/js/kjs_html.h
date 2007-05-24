// -*- c-basic-offset: 2 -*-
/*
 *  This file is part of the KDE libraries
 *  Copyright (C) 1999 Harri Porten (porten@kde.org)
 *  Copyright (C) 2004, 2006, 2007 Apple Inc. All rights reserved.
 *
 *  This library is free software; you can redistribute it and/or
 *  modify it under the terms of the GNU Lesser General Public
 *  License as published by the Free Software Foundation; either
 *  version 2 of the License, or (at your option) any later version.
 *
 *  This library is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 *  Lesser General Public License for more details.
 *
 *  You should have received a copy of the GNU Lesser General Public
 *  License along with this library; if not, write to the Free Software
 *  Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 */

#ifndef kjs_html_h
#define kjs_html_h

#include "JSDocument.h"
#include "JSElement.h"
#include "JSHTMLElement.h"

namespace WebCore {
    class HTMLCollection;
    class HTMLDocument;
    class HTMLElement;
    class HTMLOptionsCollection;
}

namespace KJS {

  class JSAbstractEventListener;

  // The inheritance chain for JSHTMLElement is a bit different from other
  // classes that are "half-autogenerated". Because we return different ClassInfo structs
  // depending on the type of element, we inherit JSHTMLElement from WebCore::JSHTMLElement
  // instead of the other way around. 
  KJS_DEFINE_PROTOTYPE_WITH_PROTOTYPE(JSHTMLElementPrototype, WebCore::JSHTMLElementPrototype)

  class JSHTMLElement : public WebCore::JSHTMLElement {
  public:
    JSHTMLElement(ExecState*, WebCore::HTMLElement*);
    virtual bool getOwnPropertySlot(ExecState*, const Identifier&, PropertySlot&);
    JSValue* getValueProperty(ExecState*, int token) const;
    virtual void put(ExecState*, const Identifier& propertyName, JSValue*, int attr = None);
    void putValueProperty(ExecState*, int token, JSValue*, int);
    virtual UString toString(ExecState*) const;
    virtual void pushEventHandlerScope(ExecState*, ScopeChain &scope) const;
    virtual JSValue* callAsFunction(ExecState*, JSObject* thisObj, const List& args);
    virtual bool implementsCall() const;
    virtual const ClassInfo* classInfo() const;
    static const ClassInfo info;

    static const ClassInfo object_info, embed_info;

    // FIXME: Might make sense to combine this with ClassInfo some day.
    typedef JSValue* (JSHTMLElement::*GetterFunction)(ExecState*, int token) const;
    typedef void (JSHTMLElement::*SetterFunction)(ExecState*, int token, JSValue*);
    struct Accessors { GetterFunction m_getter; SetterFunction m_setter; };
    const Accessors* accessors() const;
    static const Accessors object_accessors, embed_accessors;

    JSValue* objectGetter(ExecState* exec, int token) const;
    void  objectSetter(ExecState*, int token, JSValue*);
    JSValue* embedGetter(ExecState*, int token) const;
    void  embedSetter(ExecState*, int token, JSValue*);

    enum {
           ObjectHspace, ObjectHeight, ObjectAlign,
           ObjectBorder, ObjectCode, ObjectType, ObjectVspace, ObjectArchive,
           ObjectDeclare, ObjectForm, ObjectCodeBase, ObjectCodeType, ObjectData,
           ObjectName, ObjectStandby, ObjectTabIndex, ObjectUseMap, ObjectWidth, ObjectContentDocument, ObjectGetSVGDocument,
           EmbedAlign, EmbedHeight, EmbedName, EmbedSrc, EmbedType, EmbedWidth, EmbedGetSVGDocument
    };
  private:
    static JSValue* runtimeObjectGetter(ExecState*, JSObject*, const Identifier&, const PropertySlot&);
    static JSValue* runtimeObjectPropertyGetter(ExecState*, JSObject*, const Identifier&, const PropertySlot&);
  };

  WebCore::HTMLElement* toHTMLElement(JSValue*); // returns 0 if passed-in value is not a JSHTMLElement object

  KJS_DEFINE_PROTOTYPE(JSHTMLCollectionPrototype)

  class JSHTMLCollection : public DOMObject {
  public:
    JSHTMLCollection(ExecState*, WebCore::HTMLCollection*);
    ~JSHTMLCollection();
    virtual bool getOwnPropertySlot(ExecState*, const Identifier&, PropertySlot&);
    virtual JSValue* callAsFunction(ExecState*, JSObject* thisObj, const List&args);
    virtual bool implementsCall() const { return true; }
    virtual bool toBoolean(ExecState*) const { return true; }
    enum { Item, NamedItem, Tags };
    JSValue* getNamedItems(ExecState*, const Identifier& propertyName) const;
    virtual const ClassInfo* classInfo() const { return &info; }
    static const ClassInfo info;
    WebCore::HTMLCollection* impl() const { return m_impl.get(); }
  protected:
    RefPtr<WebCore::HTMLCollection> m_impl;
  private:
    static JSValue* lengthGetter(ExecState*, JSObject*, const Identifier&, const PropertySlot&);
    static JSValue* indexGetter(ExecState*, JSObject*, const Identifier&, const PropertySlot&);
    static JSValue* nameGetter(ExecState*, JSObject*, const Identifier&, const PropertySlot&);
  };

  class HTMLAllCollection : public JSHTMLCollection {
  public:
    HTMLAllCollection(ExecState* exec, WebCore::HTMLCollection* c) :
      JSHTMLCollection(exec, c) { }
    virtual bool toBoolean(ExecState*) const { return false; }
    virtual bool masqueradeAsUndefined() const { return true; }
  };
  
  ////////////////////// Image Object ////////////////////////

  class ImageConstructorImp : public DOMObject {
  public:
    ImageConstructorImp(ExecState*, WebCore::Document*);
    virtual bool implementsConstruct() const;
    virtual JSObject* construct(ExecState*, const List& args);
  private:
    RefPtr<WebCore::Document> m_doc;
  };

  JSValue* toJS(ExecState*, WebCore::HTMLOptionsCollection*);
  JSValue* getHTMLCollection(ExecState*, WebCore::HTMLCollection*);
  JSValue* getAllHTMLCollection(ExecState*, WebCore::HTMLCollection*);

} // namespace

#endif
