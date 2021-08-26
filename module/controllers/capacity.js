import {Traversal} from "../utils/traversal.js";
import { ArrayUtils } from "../utils/array-utils.js";

export class Capacity {

    static addToActor(actor, itemData) {
        if (actor.items.filter(item => item.type === "capacity" && item.data.name === itemData.name).length > 0) {
            ui.notifications.error("Vous possédez déjà cette capacité.");
            return false;
        } else {
            // activate the capacity as it is droped on an actor sheet
            // if (itemData.type === "capacity") itemData.data.checked = true;

            return actor.createEmbeddedDocuments("Item", [itemData], {});
        }
    }

    /*static removeFromActor(actor, event, entity) {
        return entity.delete();
    }*/

    /**
     * Supprime une capacité de la feuille de personnage et met à jour les infos d'un éventuel path
     * @param {*} actor 
     * @param {*} capacity 
     * @returns 
     */
     static removeFromActor(actor, capacity) {
        const capacityData = capacity.data;
        if (capacityData.data.path) {
            let path = actor.items.find(item => item.id === capacityData.data.path._id);
            if (path) {
                let pathData = duplicate(path.data);
                if (capacityData.flags.core.sourceId) {
                    let pcap = pathData.data.capacities.find(c => c.sourceId === capacityData.flags.core.sourceId);
                    pcap.data.checked = false;
                }
                return path.update(pathData).then(() => { return actor.deleteEmbeddedDocuments("Item", [capacity.id]); });
            }
        }
        return actor.deleteEmbeddedDocuments("Item", [capacity.id]);
    }

    /**
     * Callback on capacity create action
     * @param event the create event
     * @private
     */
    static create(actor, event) {
        const data = {name: "New Capacity", type: "capacity", data: {checked: true}};
        return actor.createEmbeddedDocuments("Item", [data], {renderSheet: true}); // Returns one Entity, saved to the database
    }

    /**
     *
     * @param {*} actor
     * @param {*} event
     * @param {*} isUncheck
     * @returns
     */
    static toggleCheck(actor, event, isUncheck) {
        const elt = $(event.currentTarget).parents(".capacity");
        // get id of clicked capacity
        const capId = elt.data("itemId");
        // get id of parent path
        const pathId = elt.data("pathId");
        // get path from owned items
        const path = duplicate(actor.items.get(pathId).data);
        const pathData = path.data;
        const capacities = pathData.capacities;
        const capsIds = capacities.map(c => c._id);
        const toggledRank = capsIds.indexOf(capId);
        if (isUncheck) {
            capacities.filter(c => capsIds.indexOf(c._id) >= toggledRank).map(cap => {
                cap.data.checked = false;
                return cap;
            });
        } else {
            capacities.filter(c => capsIds.indexOf(c._id) <= toggledRank).map(cap => {
                cap.data.checked = true;
                return cap;
            });
        }
        // modification de la voie (path)
        return actor.updateEmbeddedDocuments("Item", [path]).then(newPath => {
            newPath = newPath instanceof Array ? newPath[0].data : [newPath.data];
            // liste de toutes les capacités (capacities)
            return Traversal.mapItemsOfType("capacity").then(caps => {
                let items = actor.items.filter(i => i.type === "capacity" && i.data.data.path?._id === newPath._id);
                let itemsIds = items.map(i => i.data.flags.core.sourceId.split(".").pop());
                let itemsSrcIds = items.map(i => i.data.flags.core.sourceId);
                if (isUncheck) {
                    const unchecked = newPath.data.capacities.filter(c => !c.data.checked);
                    const uncheckedSrcIds = unchecked.map(c => c.data.sourceId);
                    let inter = ArrayUtils.intersection(uncheckedSrcIds, itemsSrcIds);
                    let toRemove = items.filter(i => inter.includes(i.data.flags.core.sourceId)).map(i => i.id);
                    return actor.deleteEmbeddedDocuments("Item", toRemove);
                } else {
                    const checked = newPath.data.capacities.filter(c => c.data.checked);
                    const checkedIds = checked.map(c => c._id);
                    let diff = ArrayUtils.difference(checkedIds, itemsIds);
                    let newCap = null;
                    let toAdd = checked.filter(c => diff.includes(c._id)).map(c => {
                        newCap = caps[c._id];
                        newCap.data.rank = c.data.rank;
                        newCap.data.path = c.data.path;
                        newCap.data.checked = c.data.checked;
                        newCap.flags.core = { sourceId: c.sourceId };
                        return newCap;
                    });
                    toAdd = toAdd instanceof Array ? toAdd : [toAdd];
                    let items = [];
                    toAdd.forEach(c => { items.push(c.toObject(false)) });
                    // création de l'élémént
                    return actor.createEmbeddedDocuments("Item", items);
                }
            });
        });
    }







    //
    // static toggleCheck(actor, event, isUncheck) {
    //     const elt = $(event.currentTarget).parents(".capacity");
    //     const data = duplicate(actor.data);
    //     // get id of clicked capacity
    //     const capId = elt.data("itemId");
    //     // get id of parent path
    //     const pathId = elt.data("pathId");
    //     // get path from owned items
    //     const path = actor.items.get(pathId).data;
    //     // retrieve path capacities from world/compendiums
    //     let capacities = Traversal.getItemsOfType("capacity").filter(c => {if(c && c._id) return path.data.capacities.includes(c._id)});
    //     capacities = capacities.map(c => {
    //         let cdata = duplicate(c);
    //         // if no rank, force it
    //         if(!cdata.data.rank) cdata.data.rank = path.data.capacities.indexOf(c._id) +1;
    //         // if no path, force it
    //         if(!cdata.data.path) {
    //             cdata.data.path = {
    //                 id : path._id,
    //                 name : path.name,
    //                 key : path.data.key
    //             };
    //         }
    //         return cdata;
    //     });
    //     const capacitiesKeys = capacities.map(c=>c.data.key);
    //
    //     // retrieve path's capacities already present in owned items
    //     const items = data.items.filter(i => i.type === "capacity" && capacitiesKeys.includes(i.data.key));
    //     const itemKeys = items.map(i => i.data.key);
    //
    //     if(isUncheck){
    //         const caps = capacities.filter(c => path.data.capacities.indexOf(c._id) >= path.data.capacities.indexOf(capId));
    //         const capsKeys = caps.map(c => c.data.key);
    //         // const caps = capacities.filter(c => c.data.rank >= capacity.data.rank);
    //         // REMOVE SELECTED CAPS
    //         const toRemove = items.filter(i => capsKeys.includes(i.data.key)).map(i => i._id);
    //         return actor.deleteEmbeddedDocuments("Item", toRemove, {});
    //     }else {
    //         const caps = capacities.filter(c => path.data.capacities.indexOf(c._id) <= path.data.capacities.indexOf(capId));
    //         // const caps = capacities.filter(c => c.data.rank <= capacity.data.rank);
    //         const toAdd = caps.filter(c => !itemKeys.includes(c.data.key));
    //         return actor.createEmbeddedDocuments("Item", toAdd, {});
    //     }
    // }
}