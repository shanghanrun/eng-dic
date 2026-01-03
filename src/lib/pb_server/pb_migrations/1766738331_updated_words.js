/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3124469863")

  // add field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "bool930750956",
    "name": "isMemorized",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text2548032275",
    "max": 0,
    "min": 0,
    "name": "imageUrl",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3124469863")

  // remove field
  collection.fields.removeById("bool930750956")

  // remove field
  collection.fields.removeById("text2548032275")

  return app.save(collection)
})
