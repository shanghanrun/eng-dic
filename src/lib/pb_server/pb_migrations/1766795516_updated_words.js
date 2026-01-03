/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3124469863")

  // update field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "bool930750956",
    "name": "isImportant",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3124469863")

  // update field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "bool930750956",
    "name": "isMemorized",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  return app.save(collection)
})
